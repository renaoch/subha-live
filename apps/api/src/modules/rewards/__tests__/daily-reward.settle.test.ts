import { describe, expect, it } from "vitest";
import { InMemoryDailyRewardSettle } from "./in-memory-settle";

describe("daily reward settlement (concurrency + idempotency)", () => {
  it("grants the reward and advances the streak", async () => {
    const settle = new InMemoryDailyRewardSettle();
    settle.createAccount("user-1", 0);

    const result = await settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 50 });

    expect(result.alreadyProcessed).toBe(false);
    expect(result.newCoins).toBe(50);
    expect(result.newStreak).toBe(1);
    expect(settle.getStreak("user-1").longestStreak).toBe(1);
    expect(settle.claimCount("user-1")).toBe(1);
  });

  it("does not double-grant when two concurrent claims race for the same day", async () => {
    const settle = new InMemoryDailyRewardSettle();
    settle.createAccount("user-1", 0);

    const results = await Promise.allSettled([
      settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 50 }),
      settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 50 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBe(2);
    expect(settle.getCoins("user-1")).toBe(50);
    expect(settle.getStreak("user-1").currentStreak).toBe(1);
    expect(settle.claimCount("user-1")).toBe(1);
  });

  it("returns alreadyProcessed on a retry of the same day", async () => {
    const settle = new InMemoryDailyRewardSettle();
    settle.createAccount("user-1", 0);

    await settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 50 });
    const retry = await settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 50 });

    expect(retry.alreadyProcessed).toBe(true);
    expect(settle.getCoins("user-1")).toBe(50);
    expect(settle.claimCount("user-1")).toBe(1);
  });

  it("continues a streak across consecutive days and resets after a gap", async () => {
    const settle = new InMemoryDailyRewardSettle();
    settle.createAccount("user-1", 0);

    await settle.claim({ userId: "user-1", rewardDate: "2026-10-01", rewardCoins: 10 });
    await settle.claim({ userId: "user-1", rewardDate: "2026-10-02", rewardCoins: 10 });
    const day3 = await settle.claim({ userId: "user-1", rewardDate: "2026-10-03", rewardCoins: 10 });
    expect(day3.newStreak).toBe(3);

    // Gap: skip Oct 4, claim Oct 5 -> reset to 1.
    const day5 = await settle.claim({ userId: "user-1", rewardDate: "2026-10-05", rewardCoins: 10 });
    expect(day5.newStreak).toBe(1);
    expect(settle.getStreak("user-1").longestStreak).toBe(3);
  });

  it("never grants coins to an unknown user", async () => {
    const settle = new InMemoryDailyRewardSettle();
    await expect(
      settle.claim({ userId: "missing", rewardDate: "2026-10-03", rewardCoins: 50 }),
    ).rejects.toThrow("USER_NOT_FOUND");
  });
});
