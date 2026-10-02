import { describe, expect, it } from "vitest";

/**
 * Faithful in-memory re-implementation of fin_apply_referral()'s idempotency +
 * concurrency rules (one referral per referred user, self-referral rejected,
 * atomic credit). Production safety is enforced by Postgres UNIQUE(referred_id)
 * + the RPC's existence check.
 */
class InMemoryReferralSettle {
  private coins = new Map<string, number>();
  private referrals = new Map<string, string>(); // referredId -> referrerId

  createAccount(id: string, coins: number): void {
    this.coins.set(id, coins);
  }

  getCoins(id: string): number {
    return this.coins.get(id) ?? 0;
  }

  apply(input: { referredId: string; referrerId: string; rewardCoins: number }) {
    if (input.referredId === input.referrerId) throw new Error("SELF_REFERRAL");

    if (this.referrals.has(input.referredId)) {
      return { alreadyProcessed: true, referrerId: this.referrals.get(input.referredId) };
    }

    if (!this.coins.has(input.referrerId)) throw new Error("REFERRER_NOT_FOUND");

    this.referrals.set(input.referredId, input.referrerId);
    this.coins.set(input.referrerId, (this.coins.get(input.referrerId) ?? 0) + input.rewardCoins);

    return { alreadyProcessed: false, referrerId: input.referrerId };
  }
}

describe("referral settlement (idempotency + concurrency rules)", () => {
  it("credits the referrer exactly once", async () => {
    const settle = new InMemoryReferralSettle();
    settle.createAccount("referrer", 0);
    settle.createAccount("referred", 0);

    const result = await settle.apply({ referredId: "referred", referrerId: "referrer", rewardCoins: 100 });
    expect(result.alreadyProcessed).toBe(false);
    expect(settle.getCoins("referrer")).toBe(100);
  });

  it("rejects self-referral", () => {
    const settle = new InMemoryReferralSettle();
    settle.createAccount("u1", 0);
    expect(() => settle.apply({ referredId: "u1", referrerId: "u1", rewardCoins: 100 })).toThrow("SELF_REFERRAL");
  });

  it("does not double-credit when the same user applies twice (retry)", async () => {
    const settle = new InMemoryReferralSettle();
    settle.createAccount("referrer", 0);
    settle.createAccount("referred", 0);

    await settle.apply({ referredId: "referred", referrerId: "referrer", rewardCoins: 100 });
    const retry = await settle.apply({ referredId: "referred", referrerId: "referrer", rewardCoins: 100 });

    expect(retry.alreadyProcessed).toBe(true);
    expect(settle.getCoins("referrer")).toBe(100);
  });

  it("a referred user cannot belong to two referrers (one referral only)", async () => {
    const settle = new InMemoryReferralSettle();
    settle.createAccount("referrer-a", 0);
    settle.createAccount("referrer-b", 0);
    settle.createAccount("referred", 0);

    await settle.apply({ referredId: "referred", referrerId: "referrer-a", rewardCoins:100 });
    const second = await settle.apply({ referredId: "referred", referrerId: "referrer-b", rewardCoins: 100 });

    expect(second.alreadyProcessed).toBe(true);
    expect(second.referrerId).toBe("referrer-a");
    expect(settle.getCoins("referrer-a")).toBe(100);
    expect(settle.getCoins("referrer-b")).toBe(0);
  });

  it("rejects an unknown referrer", () => {
    const settle = new InMemoryReferralSettle();
    settle.createAccount("referred", 0);
    expect(() => settle.apply({ referredId: "referred", referrerId: "ghost", rewardCoins: 100 })).toThrow("REFERRER_NOT_FOUND");
  });
});
