// Agency coin orders — pure, side-effect-free rules.
//
// Everything that decides "how much does this cost", "how many coins is it
// worth" and "does this Binance deposit legitimately pay this order" lives
// here so it is unit-testable without Binance or a database. The client never
// supplies any of these numbers.

import { randomInt } from "node:crypto";

export interface CoinTier {
  usd: number;
  baseCoins: number;
  commissionPct: number;
}

/** Single source of truth for pricing (the web UI only mirrors it for display). */
export const COIN_TIERS: readonly CoinTier[] = [
  { usd: 200, baseCoins: 1_911_000, commissionPct: 5 },
  { usd: 500, baseCoins: 4_777_500, commissionPct: 10 },
  { usd: 1_000, baseCoins: 9_555_000, commissionPct: 15 },
  { usd: 2_000, baseCoins: 19_110_000, commissionPct: 20 },
  { usd: 5_000, baseCoins: 47_775_000, commissionPct: 25 },
  { usd: 10_000, baseCoins: 95_550_000, commissionPct: 30 },
];

/** Networks we accept USDT on, mapped to Binance network codes. */
export const COIN_ORDER_NETWORKS = {
  TRC20: "TRX",
  BEP20: "BSC",
} as const;
export type CoinOrderNetworkLabel = keyof typeof COIN_ORDER_NETWORKS;

export const ORDER_COIN = "USDT";
export const ORDER_TTL_MINUTES = 60;
export const MAX_PENDING_ORDERS_PER_AGENCY = 3;

export const MICROS_PER_UNIT = 1_000_000;

export function getTier(usd: number): CoinTier | null {
  return COIN_TIERS.find((t) => t.usd === usd) ?? null;
}

/** Integer-only coin maths: commission = round(base * pct / 100). */
export function computeCoins(tier: CoinTier): { baseCoins: number; bonusCoins: number; totalCoins: number } {
  const bonusCoins = Math.round((tier.baseCoins * tier.commissionPct) / 100);
  return { baseCoins: tier.baseCoins, bonusCoins, totalCoins: tier.baseCoins + bonusCoins };
}

/**
 * Parse a decimal string ("1000.37", "1000.370000") into integer micro-units
 * without ever touching floating point. Returns null for anything malformed or
 * with more than 6 significant decimals.
 */
export function toMicros(value: string | number): number | null {
  const s = String(value).trim();
  const m = /^(\d{1,12})(?:\.(\d{1,18}))?$/.exec(s);
  if (!m) return null;
  const whole = m[1];
  const frac = (m[2] ?? "").replace(/0+$/, "");
  if (frac.length > 6) return null;
  const micros = Number(whole) * MICROS_PER_UNIT + Number(frac.padEnd(6, "0"));
  return Number.isSafeInteger(micros) ? micros : null;
}

export function formatMicros(micros: number): string {
  const whole = Math.floor(micros / MICROS_PER_UNIT);
  const frac = String(micros % MICROS_PER_UNIT).padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** tier price + a random 1..99 cent suffix that uniquely identifies the order. */
export function makePayableMicros(tierUsd: number, suffixCents: number = randomInt(1, 100)): number {
  if (!Number.isInteger(suffixCents) || suffixCents < 1 || suffixCents > 99) {
    throw new Error("suffixCents must be an integer between 1 and 99");
  }
  return tierUsd * MICROS_PER_UNIT + suffixCents * 10_000;
}

// ─── Deposit validation ──────────────────────────────────────────────────

/** Shape of a row from Binance GET /sapi/v1/capital/deposit/hisrec. */
export interface BinanceDeposit {
  id?: string;
  amount: string;
  coin: string;
  network?: string;
  status: number; // 0 pending, 1 success, 6 credited-not-withdrawable, 7 wrong, 8 awaiting confirm
  address?: string;
  txId: string;
  insertTime: number;
  transferType?: number; // 0 on-chain, 1 internal (Binance-to-Binance)
}

export interface OrderForMatch {
  coin: string;
  network: string; // Binance network code
  depositAddress: string;
  expectedMicros: number;
  createdAtMs: number;
  expiresAtMs: number;
}

export type DepositRejection =
  | "WRONG_COIN"
  | "NOT_CONFIRMED"
  | "BAD_AMOUNT"
  | "AMOUNT_MISMATCH"
  | "WRONG_NETWORK"
  | "WRONG_ADDRESS"
  | "BEFORE_ORDER"
  | "AFTER_EXPIRY"
  | "BAD_TXID";

export type DepositEvaluation =
  | { ok: true; receivedMicros: number }
  | { ok: false; reason: DepositRejection };

const CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Decides whether a deposit legitimately pays an order. Only fully-successful
 * deposits (status 1) count; anything pending/flagged is never credited.
 * On-chain deposits must also have landed on OUR address on the right network.
 * Internal Binance transfers carry no on-chain address, so they are bound by
 * coin + exact unique amount + time window alone.
 */
export function evaluateDeposit(order: OrderForMatch, deposit: BinanceDeposit): DepositEvaluation {
  if (!deposit.txId || !String(deposit.txId).trim()) return { ok: false, reason: "BAD_TXID" };
  if (deposit.coin?.toUpperCase() !== order.coin) return { ok: false, reason: "WRONG_COIN" };
  if (deposit.status !== 1) return { ok: false, reason: "NOT_CONFIRMED" };

  const received = toMicros(deposit.amount);
  if (received === null || received <= 0) return { ok: false, reason: "BAD_AMOUNT" };
  if (received !== order.expectedMicros) return { ok: false, reason: "AMOUNT_MISMATCH" };

  if (deposit.transferType !== 1) {
    if ((deposit.network ?? "").toUpperCase() !== order.network.toUpperCase()) {
      return { ok: false, reason: "WRONG_NETWORK" };
    }
    if ((deposit.address ?? "").trim() !== order.depositAddress.trim()) {
      return { ok: false, reason: "WRONG_ADDRESS" };
    }
  }

  if (deposit.insertTime < order.createdAtMs - CLOCK_SKEW_MS) return { ok: false, reason: "BEFORE_ORDER" };
  if (deposit.insertTime > order.expiresAtMs) return { ok: false, reason: "AFTER_EXPIRY" };

  return { ok: true, receivedMicros: received };
}