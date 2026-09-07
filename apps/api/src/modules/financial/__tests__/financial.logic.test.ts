import { describe, expect, it } from "vitest";
import {
  computeGiftSplit,
  isGiftSplitBalanced,
  extractFinancialErrorCode,
  DEFAULT_HOST_SHARE_RATE,
} from "../financial.logic";

describe("computeGiftSplit", () => {
  it("splits diamonds between host and platform using the default rate", () => {
    const split = computeGiftSplit(1000, DEFAULT_HOST_SHARE_RATE);
    expect(split.hostNetDiamonds).toBe(600);
    expect(split.platformNetDiamonds).toBe(400);
    expect(split.agencyCommissionDiamonds).toBe(0);
  });

  it("carves the agency commission out of the platform share, not the host's cut", () => {
    // 1000 diamonds, 60% host share -> host 600, platform pool 400.
    // Agency commission rate 25% of the platform pool -> 100 to the agency,
    // 300 remains with the platform. The host's 600 is untouched either way.
    const split = computeGiftSplit(1000, 0.6, 25);
    expect(split.hostNetDiamonds).toBe(600);
    expect(split.agencyCommissionDiamonds).toBe(100);
    expect(split.platformShareDiamonds).toBe(300);
  });

  it("never lets the agency commission exceed the platform's share", () => {
    const split = computeGiftSplit(10, 0.99, 100); // platform pool is tiny (1, after floor)
    expect(split.agencyCommissionDiamonds).toBe(1);
    expect(split.platformShareDiamonds).toBe(0); // all of the tiny pool went to the agency, none left over
  });

  it("always reconciles: host + platform + agency === total value", () => {
    for (const value of [0, 1, 6, 60, 300, 3000, 999999]) {
      for (const rate of [0, 0.25, 0.5, 0.6, 1]) {
        for (const agencyRate of [0, 10, 50, 100]) {
          const split = computeGiftSplit(value, rate, agencyRate);
          expect(isGiftSplitBalanced(value, split)).toBe(true);
        }
      }
    }
  });

  it("rejects an invalid host share rate", () => {
    expect(() => computeGiftSplit(100, 1.5)).toThrow();
    expect(() => computeGiftSplit(100, -0.1)).toThrow();
  });

  it("rejects a negative diamond value", () => {
    expect(() => computeGiftSplit(-1)).toThrow();
  });

  it("handles a zero-value gift (progress-only / free gift) without dividing by zero", () => {
    const split = computeGiftSplit(0, 0.6, 30);
    expect(split).toEqual({
      hostNetDiamonds: 0,
      platformShareDiamonds: 0,
      agencyCommissionDiamonds: 0,
      platformNetDiamonds: 0,
    });
  });
});

describe("extractFinancialErrorCode", () => {
  it("finds a known code embedded in a Postgres error message", () => {
    expect(extractFinancialErrorCode("INSUFFICIENT_BALANCE")).toBe("INSUFFICIENT_BALANCE");
    expect(extractFinancialErrorCode("error: INSUFFICIENT_BALANCE (context)")).toBe("INSUFFICIENT_BALANCE");
  });

  it("returns null for an unrecognized message", () => {
    expect(extractFinancialErrorCode("some unrelated database error")).toBeNull();
    expect(extractFinancialErrorCode(null)).toBeNull();
    expect(extractFinancialErrorCode(undefined)).toBeNull();
  });
});
