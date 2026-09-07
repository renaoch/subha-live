import { describe, expect, it } from "vitest";
import { InMemoryLedger, InsufficientBalanceError } from "./in-memory-ledger";

// These tests exercise the LOCKING + IDEMPOTENCY ALGORITHM used by
// fin_send_gift() / fin_confirm_payment() (see in-memory-ledger.ts for why
// this is a JS reference model rather than a live-DB test). They prove the
// algorithm itself — claim idempotency before mutating, lock before
// reading balances, verify under the lock, all-or-nothing mutation — is
// correct under real concurrency (Promise.all races), independent of
// whether Postgres or this in-memory store is doing the locking.
//
// The actual production guarantee is enforced by Postgres row locks
// (SELECT ... FOR UPDATE) and unique constraints in
// supabase/migrations/20260903120000_financial_system.sql.

function makeGift(overrides: Partial<{ coinPrice: number; diamondValue: number; hostShareRate: number }> = {}) {
  return {
    coinPrice: 100,
    diamondValue: 60,
    hostShareRate: 0.6,
    ...overrides,
  };
}

describe("concurrent gift requests", () => {
  it("never drives a sender's balance negative when many gifts race", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 500); // enough for exactly 5 gifts of 100
    ledger.createAccount("host", 0);

    const attempts = 20; // far more attempts than the balance allows
    const gift = makeGift();

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        ledger.sendGift({
          senderId: "sender",
          recipientId: "host",
          ...gift,
          clientRequestId: `attempt-${i}`, // each attempt is a DIFFERENT gift
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // Exactly 5 could ever succeed (500 / 100), regardless of race timing.
    expect(succeeded.length).toBe(5);
    expect(failed.length).toBe(attempts - 5);
    for (const f of failed) {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientBalanceError);
    }

    const senderFinal = ledger.getAccount("sender");
    const hostFinal = ledger.getAccount("host");
    expect(senderFinal.coins).toBe(0); // never negative, never "lost" a debit
    expect(hostFinal.diamonds).toBe(5 * Math.floor(60 * 0.6)); // every successful gift credited exactly once
  });

  it("never loses an update when two DIFFERENT senders gift the same host at once", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender-a", 1000);
    ledger.createAccount("sender-b", 1000);
    ledger.createAccount("host", 0);

    const gift = makeGift();

    await Promise.all([
      ledger.sendGift({ senderId: "sender-a", recipientId: "host", ...gift, clientRequestId: "a-1" }),
      ledger.sendGift({ senderId: "sender-b", recipientId: "host", ...gift, clientRequestId: "b-1" }),
    ]);

    const host = ledger.getAccount("host");
    // Both credits must land — a lost update would show only one.
    expect(host.diamonds).toBe(2 * Math.floor(60 * 0.6));
  });

  it("does not deadlock when two gifts flow in opposite directions at the same time", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("alice", 1000);
    ledger.createAccount("bob", 1000);

    const gift = makeGift();

    // alice -> bob AND bob -> alice, simultaneously. The deterministic
    // lock ordering (sorted ids) inside sendGift must prevent a deadlock
    // here; if it didn't, this Promise.all would hang and the test would
    // time out.
    await Promise.all([
      ledger.sendGift({ senderId: "alice", recipientId: "bob", ...gift, clientRequestId: "alice-to-bob" }),
      ledger.sendGift({ senderId: "bob", recipientId: "alice", ...gift, clientRequestId: "bob-to-alice" }),
    ]);

    expect(ledger.getAccount("alice").coins).toBe(900);
    expect(ledger.getAccount("bob").coins).toBe(900);
    expect(ledger.getAccount("alice").diamonds).toBe(Math.floor(60 * 0.6));
    expect(ledger.getAccount("bob").diamonds).toBe(Math.floor(60 * 0.6));
  });
});

describe("duplicate gift requests (idempotency)", () => {
  it("charges exactly once when the SAME client_request_id is submitted concurrently (double-tap)", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 1000);
    ledger.createAccount("host", 0);

    const gift = makeGift();
    const clientRequestId = "double-tap-1";

    const results = await Promise.allSettled([
      ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId }),
      ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId }),
      ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId }),
    ]);

    // Only ONE debit should ever have happened, no matter how many
    // duplicate requests raced in with the same idempotency key.
    expect(ledger.getAccount("sender").coins).toBe(900);
    expect(ledger.getAccount("host").diamonds).toBe(Math.floor(60 * 0.6));

    // Every settled (non-"in progress") result reports the SAME outcome.
    const settled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<InMemoryLedger["sendGift"]>>> => r.status === "fulfilled"
    );
    for (const r of settled) {
      expect(r.value.senderNewCoins).toBe(900);
    }
  });

  it("charges exactly once when the same client_request_id is retried sequentially after success", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 1000);
    ledger.createAccount("host", 0);
    const gift = makeGift();

    const first = await ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId: "retry-1" });
    expect(first.alreadyProcessed).toBe(false);

    // Client never got the response and retries with the SAME id.
    const second = await ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId: "retry-1" });
    expect(second.alreadyProcessed).toBe(true);
    expect(second.senderNewCoins).toBe(first.senderNewCoins);

    expect(ledger.getAccount("sender").coins).toBe(900); // debited once, not twice
  });

  it("does NOT dedupe two genuinely different gifts from the same sender", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 1000);
    ledger.createAccount("host", 0);
    const gift = makeGift();

    await ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId: "gift-1" });
    await ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId: "gift-2" });

    expect(ledger.getAccount("sender").coins).toBe(800); // charged twice, as intended
  });
});

describe("duplicate payment webhooks", () => {
  it("credits coins exactly once no matter how many times the webhook fires", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("user-1", 0);

    const payment = {
      userId: "user-1",
      provider: "stripe",
      providerTransactionId: "pi_12345",
      coins: 1000,
    };

    // Simulate a retry storm: the payment gateway fires the same webhook
    // 10 times concurrently (a common real-world failure mode).
    const results = await Promise.all(Array.from({ length: 10 }, () => ledger.confirmPayment(payment)));

    expect(ledger.getAccount("user-1").coins).toBe(1000); // credited once, not 10x

    const successfulFirsts = results.filter((r) => !r.alreadyProcessed);
    expect(successfulFirsts.length).toBe(1); // exactly one call actually credited
  });

  it("treats a different provider_transaction_id as a genuinely new payment", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("user-1", 0);

    await ledger.confirmPayment({ userId: "user-1", provider: "stripe", providerTransactionId: "pi_1", coins: 500 });
    await ledger.confirmPayment({ userId: "user-1", provider: "stripe", providerTransactionId: "pi_2", coins: 500 });

    expect(ledger.getAccount("user-1").coins).toBe(1000);
  });
});

describe("insufficient balance", () => {
  it("rejects a gift the sender cannot afford and leaves balances untouched", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 50);
    ledger.createAccount("host", 0);

    await expect(
      ledger.sendGift({ senderId: "sender", recipientId: "host", ...makeGift({ coinPrice: 100 }), clientRequestId: "too-poor" })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    expect(ledger.getAccount("sender").coins).toBe(50); // untouched
    expect(ledger.getAccount("host").diamonds).toBe(0); // untouched
  });
});

describe("negative balance prevention", () => {
  it("never allows coins to go negative even under a heavy concurrent burst at the exact boundary", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 100); // exactly enough for ONE gift
    ledger.createAccount("host", 0);
    const gift = makeGift({ coinPrice: 100 });

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        ledger.sendGift({ senderId: "sender", recipientId: "host", ...gift, clientRequestId: `burst-${i}` })
      )
    );

    expect(ledger.getAccount("sender").coins).toBe(0);
    expect(ledger.getAccount("sender").coins).toBeGreaterThanOrEqual(0);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
  });
});

describe("failed transactions / rollback", () => {
  it("leaves no balance change when the recipient does not exist", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 1000);
    // no "ghost" account created

    await expect(
      ledger.sendGift({ senderId: "sender", recipientId: "ghost", ...makeGift(), clientRequestId: "to-nowhere" })
    ).rejects.toThrow("RECIPIENT_NOT_FOUND");

    // Sender must NOT have been debited even though the failure happened
    // partway through — the debit and credit are applied atomically
    // together or not at all.
    expect(ledger.getAccount("sender").coins).toBe(1000);
  });

  it("allows a fresh retry with the same client_request_id after a failed attempt", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount("sender", 1000);
    ledger.createAccount("host", 0);

    // First attempt fails: sender has plenty of coins, but let's fail it
    // via an unaffordable price to land in the 'failed' branch, then fix
    // up and retry with the SAME clientRequestId.
    await expect(
      ledger.sendGift({ senderId: "sender", recipientId: "host", ...makeGift({ coinPrice: 5000 }), clientRequestId: "fixable" })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    expect(ledger.getAccount("sender").coins).toBe(1000); // rolled back, nothing charged

    // Retry the SAME idempotency key with an affordable price — this must
    // be allowed to proceed fresh (a failed attempt shouldn't permanently
    // lock out that idempotency key).
    const retry = await ledger.sendGift({
      senderId: "sender",
      recipientId: "host",
      ...makeGift({ coinPrice: 100 }),
      clientRequestId: "fixable",
    });

    expect(retry.alreadyProcessed).toBe(false);
    expect(ledger.getAccount("sender").coins).toBe(900);
  });
});
