import { describe, expect, it } from "vitest";
import { balanceAfterPayment, canAfford, validateAmount } from "./trading.logic";

describe("validateAmount", () => {
  it("accepts positive integers", () => {
    expect(validateAmount(1000)).toEqual({ ok: true, amount: 1000 });
  });

  it("rejects zero", () => {
    expect(validateAmount(0).ok).toBe(false);
  });

  it("rejects negatives", () => {
    expect(validateAmount(-100).ok).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(validateAmount(NaN).ok).toBe(false);
    expect(validateAmount(Infinity).ok).toBe(false);
    expect(validateAmount(-Infinity).ok).toBe(false);
  });

  it("rejects decimals (integer units only)", () => {
    expect(validateAmount(100.5).ok).toBe(false);
    expect(validateAmount(0.1).ok).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(validateAmount("1000").ok).toBe(false);
    expect(validateAmount(null).ok).toBe(false);
    expect(validateAmount(undefined).ok).toBe(false);
  });

  it("rejects values above the cap", () => {
    expect(validateAmount(10_000_000_000)).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects values above the available balance", () => {
    expect(validateAmount(600_000, 500_000)).toEqual({ ok: false, reason: "insufficient" });
  });

  it("accepts values within the available balance", () => {
    expect(validateAmount(500_000, 500_000)).toEqual({ ok: true, amount: 500_000 });
  });
});

describe("canAfford / balanceAfterPayment", () => {
  it("computes the remaining balance with integer arithmetic", () => {
    expect(canAfford(1_250_000, 100_000)).toBe(true);
    expect(balanceAfterPayment(1_250_000, 100_000)).toBe(1_150_000);
  });

  it("rejects an amount exceeding balance", () => {
    expect(canAfford(500_000, 600_000)).toBe(false);
  });
});
