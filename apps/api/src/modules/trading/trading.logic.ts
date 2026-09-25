// Trading Center — pure, side-effect-free validation logic.
//
// Amount validation must reject every malformed value before it reaches the
// database. Kept pure so the exact rules are unit-testable without a DB. The
// service layer runs this AFTER the zod schema (defense-in-depth: zod checks the
// HTTP shape, this re-checks integer/coin semantics against the balance).

import { MAX_COIN_AMOUNT } from "./trading.schema";

export type AmountResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "invalid" | "too_large" | "insufficient" };

/**
 * Normalize + validate a coin amount. Rejects:
 *   - non-numbers, NaN, Infinity/-Infinity
 *   - non-integers (decimal values)
 *   - zero and negatives
 *   - values above the bigint-safe cap
 * Uses integer arithmetic only (no floating-point division/multiplication).
 */
export function validateAmount(value: unknown, available?: number): AmountResult {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: "invalid" };
  }

  const amount = Math.trunc(value);
  if (amount !== value) return { ok: false, reason: "invalid" }; // non-integer
  if (amount <= 0) return { ok: false, reason: "invalid" };
  if (amount > MAX_COIN_AMOUNT) return { ok: false, reason: "too_large" };

  if (available !== undefined && amount > available) {
    return { ok: false, reason: "insufficient" };
  }

  return { ok: true, amount };
}

/** Balance after paying `amount` (integer arithmetic). */
export function balanceAfterPayment(available: number, amount: number): number {
  return available - amount;
}

/** True when the amount can be covered by the available balance. */
export function canAfford(available: number, amount: number): boolean {
  return amount <= available;
}
