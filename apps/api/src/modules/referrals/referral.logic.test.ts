import { describe, expect, it } from "vitest";
import { codeFromBytes, isValidCodeShape, REFERRAL_REWARD_COINS } from "./referral.logic";

describe("referral code logic", () => {
  it("generates an 8-char code from the safe alphabet", () => {
    const code = codeFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(code).toHaveLength(8);
    expect(isValidCodeShape(code)).toBe(true);
  });

  it("avoids ambiguous characters", () => {
    const code = codeFromBytes(new Uint8Array(Array.from({ length: 16 }, (_, i) => i)));
    expect(code).not.toMatch(/[0O1I]/);
  });

  it("validates code shape (length + alphabet)", () => {
    expect(isValidCodeShape("ABCDEFGH")).toBe(true);
    expect(isValidCodeShape("ABC")).toBe(false);
    expect(isValidCodeShape("ABCDEFG0")).toBe(false); // '0' is not in the alphabet
    expect(isValidCodeShape("ABCDEFGI")).toBe(false); // 'I' is not in the alphabet
  });

  it("has a positive reward per referral", () => {
    expect(REFERRAL_REWARD_COINS).toBeGreaterThan(0);
  });
});
