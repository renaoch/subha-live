// components/trading/format.ts
//
// Exact, integer-safe coin formatting for financial UI. Never uses
// floating-point rounding — coins are whole numbers.

export function formatCoins(value: number): string {
  return Math.trunc(value).toLocaleString("en-IN");
}
