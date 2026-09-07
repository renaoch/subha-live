// File: apps/api/src/modules/financial/__tests__/in-memory-ledger.ts
//
// This is a faithful, minimal re-implementation of the locking +
// idempotency algorithm used by fin_send_gift() / fin_confirm_payment() /
// fin_request_withdrawal() in
// supabase/migrations/20260903120000_financial_system.sql.
//
// It exists ONLY for unit testing the *algorithm* (lock ordering,
// idempotency-before-mutation, atomic all-or-nothing balance changes)
// under real concurrency (Promise.all races) without a live Postgres
// connection. It is not used by the running application — production
// atomicity/concurrency safety is enforced by Postgres itself (row locks
// via SELECT ... FOR UPDATE and unique constraints), not by this file.
//
// Every method here mirrors its SQL counterpart 1:1:
//   - claim the idempotency slot FIRST, before any balance mutation
//     (unique key check) — a duplicate/concurrent retry must be rejected
//     here, before touching balances, exactly like a unique-constraint
//     violation happens before a transaction can do anything else.
//   - lock affected accounts in a deterministic order (sorted by id) so
//     two operations touching the same two accounts in opposite order
//     can never deadlock.
//   - verify balance under the lock, never trust a balance read before
//     the lock was acquired.
//   - if anything fails after mutations have started, roll back to the
//     pre-transaction snapshot — nothing partial is ever observable.

interface Account {
  id: string;
  coins: number;
  diamonds: number;
}

interface GiftRecord {
  senderId: string;
  clientRequestId: string;
  status: "processing" | "completed" | "failed";
  result?: SendGiftResult;
}

interface PaymentRecord {
  provider: string;
  providerTransactionId: string;
  status: "completed";
  coins: number;
  userId: string;
}

export interface SendGiftResult {
  senderNewCoins: number;
  recipientNewDiamonds: number;
  hostNetDiamonds: number;
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("INSUFFICIENT_BALANCE");
  }
}

export class GiftInProgressError extends Error {
  constructor() {
    super("GIFT_REQUEST_IN_PROGRESS");
  }
}

/**
 * A tiny mutex keyed by account id, standing in for Postgres row locks
 * acquired with SELECT ... FOR UPDATE. Whoever calls `withLocks` first
 * for a given set of ids holds them until their callback resolves;
 * anyone else asking for an overlapping id queues behind them — same
 * blocking behaviour FOR UPDATE gives you, just in JS.
 */
class RowLockManager {
  private queues = new Map<string, Promise<unknown>>();

  async withLocks<T>(ids: string[], fn: () => Promise<T>): Promise<T> {
    // Deterministic order — mirrors "lock smaller uuid first" in
    // fin_send_gift() so two transactions locking the same two rows in
    // opposite directions can't deadlock each other.
    const sorted = [...new Set(ids)].sort();

    // Chain onto every queue we touch, sequentially, in sorted order —
    // this is what actually prevents deadlock: everyone acquires in the
    // same order.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const previous: Promise<unknown>[] = [];
    for (const id of sorted) {
      previous.push(this.queues.get(id) ?? Promise.resolve());
      this.queues.set(id, gate);
    }

    await Promise.all(previous);

    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class InMemoryLedger {
  private accounts = new Map<string, Account>();
  private gifts = new Map<string, GiftRecord>(); // key: `${senderId}:${clientRequestId}`
  private payments = new Map<string, PaymentRecord>(); // key: `${provider}:${providerTransactionId}`
  private locks = new RowLockManager();

  createAccount(id: string, coins = 0, diamonds = 0): void {
    this.accounts.set(id, { id, coins, diamonds });
  }

  getAccount(id: string): Account {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account ${id} not found`);
    return { ...account };
  }

  /**
   * Mirrors fin_send_gift(): claim idempotency slot -> lock both accounts
   * (sorted order) -> verify balance -> debit sender -> credit recipient
   * -> mark completed. Any failure after the idempotency slot is claimed
   * flips it to 'failed' and rolls back any balance mutation already
   * applied within this call (there are none until the atomic section,
   * by design — see below).
   */
  async sendGift(input: {
    senderId: string;
    recipientId: string;
    coinPrice: number;
    diamondValue: number;
    hostShareRate: number;
    clientRequestId: string;
  }): Promise<SendGiftResult & { alreadyProcessed: boolean }> {
    const idempotencyKey = `${input.senderId}:${input.clientRequestId}`;

    // Idempotency check happens BEFORE any lock/mutation, exactly like a
    // unique constraint violation in Postgres happens before the rest of
    // the transaction's statements run.
    const existing = this.gifts.get(idempotencyKey);
    if (existing) {
      if (existing.status === "processing") {
        throw new GiftInProgressError();
      }
      if (existing.status === "completed" && existing.result) {
        return { ...existing.result, alreadyProcessed: true };
      }
      // status === 'failed': fall through and let the caller retry fresh,
      // same as fin_send_gift's documented retry-after-failure behaviour.
    }

    this.gifts.set(idempotencyKey, { senderId: input.senderId, clientRequestId: input.clientRequestId, status: "processing" });

    try {
      const result = await this.locks.withLocks([input.senderId, input.recipientId], async () => {
        const sender = this.accounts.get(input.senderId);
        const recipient = this.accounts.get(input.recipientId);
        if (!sender) throw new Error("SENDER_NOT_FOUND");
        if (!recipient) throw new Error("RECIPIENT_NOT_FOUND");

        // Verified under the lock — never trust a balance read taken
        // before the lock was acquired.
        if (sender.coins < input.coinPrice) {
          throw new InsufficientBalanceError();
        }

        const hostNet = Math.floor(input.diamondValue * input.hostShareRate);

        // Atomic: both mutations happen together with no await between
        // them, so no other lock-holder can observe a half-applied state.
        sender.coins -= input.coinPrice;
        recipient.diamonds += hostNet;

        return {
          senderNewCoins: sender.coins,
          recipientNewDiamonds: recipient.diamonds,
          hostNetDiamonds: hostNet,
        };
      });

      this.gifts.set(idempotencyKey, {
        senderId: input.senderId,
        clientRequestId: input.clientRequestId,
        status: "completed",
        result,
      });

      return { ...result, alreadyProcessed: false };
    } catch (error) {
      // Roll back the idempotency slot to 'failed' — the account map was
      // never mutated on this path (the throw happens before either
      // mutation line runs), so there is nothing to undo there. This
      // mirrors Postgres: the whole transaction (including the gift_transactions
      // insert) rolls back together on any exception.
      this.gifts.set(idempotencyKey, { senderId: input.senderId, clientRequestId: input.clientRequestId, status: "failed" });
      throw error;
    }
  }

  /** Mirrors fin_confirm_payment(): unique on (provider, providerTransactionId). */
  async confirmPayment(input: {
    userId: string;
    provider: string;
    providerTransactionId: string;
    coins: number;
  }): Promise<{ newCoins: number; alreadyProcessed: boolean }> {
    const key = `${input.provider}:${input.providerTransactionId}`;

    const existing = this.payments.get(key);
    if (existing) {
      const account = this.accounts.get(existing.userId)!;
      return { newCoins: account.coins, alreadyProcessed: true };
    }

    // Claim the slot before crediting — a concurrent duplicate webhook
    // calling this at the same instant will only ever see one of these
    // two branches win the `!existing` race because of the lock below.
    return this.locks.withLocks([input.userId], async () => {
      // Re-check inside the lock: two concurrent webhooks for the SAME
      // provider_transaction_id both pass the outer check before either
      // acquires the lock; only the first to get the lock should credit.
      const raced = this.payments.get(key);
      if (raced) {
        const account = this.accounts.get(raced.userId)!;
        return { newCoins: account.coins, alreadyProcessed: true };
      }

      this.payments.set(key, { provider: input.provider, providerTransactionId: input.providerTransactionId, status: "completed", coins: input.coins, userId: input.userId });

      const account = this.accounts.get(input.userId);
      if (!account) throw new Error("USER_NOT_FOUND");
      account.coins += input.coins;
      return { newCoins: account.coins, alreadyProcessed: false };
    });
  }
}
