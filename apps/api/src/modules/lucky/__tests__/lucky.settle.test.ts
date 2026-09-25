import { describe, expect, it } from "vitest";
import { InMemorySettle, InsufficientBalanceError } from "./in-memory-settle";

describe("lucky settlement (concurrency + idempotency)", () => {
  it("does not double-spend when two spins race with the same balance", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 1000);

    // Two DIFFERENT spins race for the same 1000 coins. Exactly one settles;
    // the other is rejected with insufficient balance. No double-spend.
    const results = await Promise.allSettled([
      settle.spin({ userId: "user-1", clientRequestId: "a", bet: 1000, payout: 0 }),
      settle.spin({ userId: "user-1", clientRequestId: "b", bet: 1000, payout: 0 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(settle.getCoins("user-1")).toBe(0);
    expect(settle.roundCount("user-1")).toBe(1);
  });

  it("serializes concurrent spins so the second sees the reduced balance", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 1000);

    // Two spins of 1000 each; only one can succeed, the other throws.
    await expect(
      Promise.all([
        settle.spin({ userId: "user-1", clientRequestId: "a", bet: 1000, payout: 0 }),
        settle.spin({ userId: "user-1", clientRequestId: "b", bet: 1000, payout: 0 }),
      ]),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(settle.getCoins("user-1")).toBe(0);
    expect(settle.roundCount("user-1")).toBe(1);
  });

  it("is idempotent: retrying the same request returns the original result without paying twice", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 1000);

    const first = await settle.spin({ userId: "user-1", clientRequestId: "same", bet: 1000, payout: 500 });
    const second = await settle.spin({ userId: "user-1", clientRequestId: "same", bet: 1000, payout: 500 });

    expect(first.newCoins).toBe(500);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.newCoins).toBe(500);
    expect(settle.getCoins("user-1")).toBe(500);
    expect(settle.roundCount("user-1")).toBe(1);
  });

  it("never produces a negative balance", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 100);

    await expect(
      settle.spin({ userId: "user-1", clientRequestId: "x", bet: 1000, payout: 0 }),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(settle.getCoins("user-1")).toBe(100);
    expect(settle.roundCount("user-1")).toBe(0);
  });

  it("credits the payout exactly once on a win", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 10_000);

    const result = await settle.spin({ userId: "user-1", clientRequestId: "win", bet: 1000, payout: 5000 });

    expect(result.newCoins).toBe(14_000);
    expect(settle.getCoins("user-1")).toBe(14_000);
  });

  it("allows two distinct spins after the first resolves", async () => {
    const settle = new InMemorySettle();
    settle.createAccount("user-1", 3000);

    await settle.spin({ userId: "user-1", clientRequestId: "one", bet: 1000, payout: 0 });
    const second = await settle.spin({ userId: "user-1", clientRequestId: "two", bet: 1000, payout: 0 });

    expect(second.newCoins).toBe(1000);
    expect(settle.roundCount("user-1")).toBe(2);
  });
});
