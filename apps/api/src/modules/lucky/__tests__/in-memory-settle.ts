// File: apps/api/src/modules/lucky/__tests__/in-memory-settle.ts
//
// Faithful in-memory re-implementation of the locking + idempotency algorithm
// used by fin_lucky_spin() in supabase/migrations/20260924000000_lucky_game.sql.
// Exists ONLY for unit-testing the algorithm (lock ordering, idempotency-before-
// mutation, balance verification, atomic all-or-nothing settlement) under real
// concurrency (Promise.all races) without a live Postgres. Production safety is
// enforced by Postgres itself (SELECT ... FOR UPDATE + the unique constraint on
// (user_id, client_request_id)), not by this file.

export class InsufficientBalanceError extends Error {
  constructor() {
    super("INSUFFICIENT_BALANCE");
  }
}

interface Account {
  id: string;
  coins: number;
}

interface Round {
  userId: string;
  clientRequestId: string;
  bet: number;
  payout: number;
  newCoins: number;
}

/** Tiny per-user mutex standing in for SELECT ... FOR UPDATE on profiles. */
class RowLockManager {
  private queues = new Map<string, Promise<unknown>>();

  async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.queues.set(id, gate);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class InMemorySettle {
  private accounts = new Map<string, Account>();
  private rounds = new Map<string, Round>(); // key: `${userId}:${clientRequestId}`
  private locks = new RowLockManager();

  createAccount(id: string, coins: number): void {
    this.accounts.set(id, { id, coins });
  }

  getCoins(id: string): number {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account ${id} not found`);
    return account.coins;
  }

  roundCount(userId: string): number {
    return [...this.rounds.keys()].filter((k) => k.startsWith(`${userId}:`)).length;
  }

  /**
   * Mirrors fin_lucky_spin(): lock profile -> idempotency check -> verify
   * balance -> settle (debit bet, credit payout) -> record round. All-or-nothing.
   */
  async spin(input: {
    userId: string;
    clientRequestId: string;
    bet: number;
    payout: number;
  }): Promise<{ newCoins: number; alreadyProcessed: boolean }> {
    const key = `${input.userId}:${input.clientRequestId}`;

    return this.locks.withLock(input.userId, async () => {
      const existing = this.rounds.get(key);
      if (existing) {
        return { newCoins: existing.newCoins, alreadyProcessed: true };
      }

      const account = this.accounts.get(input.userId);
      if (!account) throw new Error("USER_NOT_FOUND");

      // Balance verified under the lock — never a stale read.
      if (account.coins < input.bet) {
        throw new InsufficientBalanceError();
      }

      const newCoins = account.coins - input.bet + input.payout;
      if (newCoins < 0) {
        throw new Error("NEGATIVE_BALANCE");
      }

      account.coins = newCoins;
      this.rounds.set(key, { userId: input.userId, clientRequestId: input.clientRequestId, bet: input.bet, payout: input.payout, newCoins });

      return { newCoins, alreadyProcessed: false };
    });
  }
}
