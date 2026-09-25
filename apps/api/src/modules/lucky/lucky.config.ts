// Subha Lucky — server-side game configuration.
//
// This is the SINGLE source of truth for symbols, bets, paytable, reward
// weights and limits. The frontend never hardcodes a bet or multiplier; it
// fetches the public config via GET /api/v1/lucky/config.
//
// Weights (probability internals) and the RNG are deliberately server-only and
// never exposed to the browser — the public config surface is just the symbol
// catalog, the transparent paytable, the bet list and the payout cap.

import type { LuckyGrid, LuckyPublicConfig, LuckySymbol, LuckySymbolId } from "./lucky.types";
import { LUCKY_GRID_SIZE } from "./lucky.types";

/** Bump whenever the symbols/weights/paytable change so old rounds stay legible. */
export const LUCKY_CONFIG_VERSION = 1;

/** Selectable bets in coins. Authoritative — the client only ever echoes one of these. */
export const LUCKY_BETS = [100, 1_000, 10_000, 50_000] as const;

/** Absolute cap on a single spin's payout (applied after multiplier). */
export const LUCKY_MAX_PAYOUT = 5_000_000;

/**
 * Symbol catalog. `multiplier` is what a 3-of-a-kind line pays (a Lucky line
 * pays `LUCKY_JACKPOT_MULTIPLIER`). Order defines the display order.
 */
export const LUCKY_SYMBOLS: LuckySymbol[] = [
  { id: "orange", name: "Orange", multiplier: 2 },
  { id: "lemon", name: "Lemon", multiplier: 2 },
  { id: "grapes", name: "Grapes", multiplier: 4 },
  { id: "cherry", name: "Cherry", multiplier: 5 },
  { id: "apple", name: "Apple", multiplier: 8 },
  { id: "watermelon", name: "Watermelon", multiplier: 15 },
  { id: "mango", name: "Mango", multiplier: 20 },
  { id: "strawberry", name: "Strawberry", multiplier: 30 },
  { id: "lucky", name: "Lucky", multiplier: 0 }, // wild; jackpot line uses LUCKY_JACKPOT_MULTIPLIER
];

export const LUCKY_JACKPOT_MULTIPLIER = 88;

/**
 * Per-cell draw weights (NOT a probability table the client needs — keep
 * server-only). Rarer symbols carry higher multipliers; Lucky is the rarest.
 */
export const LUCKY_WEIGHTS: Record<LuckySymbolId, number> = {
  orange: 26,
  lemon: 24,
  grapes: 18,
  cherry: 15,
  apple: 10,
  watermelon: 6,
  mango: 5,
  strawberry: 3,
  lucky: 2,
};

/**
 * Paylines: indices into the 3x3 grid (row-major). 3 horizontal rows, 3
 * vertical columns and 2 diagonals. Each line pays independently; winnings
 * stack across lines.
 */
export const LUCKY_PAYLINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The public (non-sensitive) config surface served to the client. */
export function getPublicLuckyConfig(): LuckyPublicConfig {
  return {
    configVersion: LUCKY_CONFIG_VERSION,
    gameType: "subha_lucky",
    bets: [...LUCKY_BETS],
    symbols: LUCKY_SYMBOLS.map((s) => ({ ...s })),
    jackpotMultiplier: LUCKY_JACKPOT_MULTIPLIER,
    maxPayout: LUCKY_MAX_PAYOUT,
  };
}

export function isBetAllowed(bet: number): boolean {
  return (LUCKY_BETS as readonly number[]).includes(bet);
}

export function symbolMultiplier(id: LuckySymbolId): number {
  const symbol = LUCKY_SYMBOLS.find((s) => s.id === id);
  if (!symbol) return 0;
  if (id === "lucky") return LUCKY_JACKPOT_MULTIPLIER;
  return symbol.multiplier;
}

export function isValidGrid(grid: LuckyGrid): boolean {
  if (grid.length !== LUCKY_GRID_SIZE) return false;
  const valid = new Set(LUCKY_SYMBOLS.map((s) => s.id));
  return grid.every((id) => valid.has(id));
}
