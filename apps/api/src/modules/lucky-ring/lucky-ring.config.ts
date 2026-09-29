// Lucky Ring — shared-room pari-mutuel version of the "lucky pro" cabinet
// (10-cell ring + center counter, everyone in the room bets on the same
// round, board reveals once for all of them).
//
// This is a DIFFERENT game type from Subha Lucky (modules/lucky) — that one
// is a personal, instant-spin 3x3 payline slot. This one is a room-wide
// timed round: BETTING -> SPINNING -> SETTLED -> next BETTING, looping
// forever while the room is active. Both reuse the same symbol catalog /
// icon set (LuckySymbolId) and the same coins economy (profiles.coins +
// financial_ledger), but everything else — schema, RNG, settlement — is
// separate and lives here.

import type { LuckySymbolId } from "../lucky/lucky.types";

export const LUCKY_RING_GAME_TYPE = "lucky_ring" as const;
export const LUCKY_RING_CONFIG_VERSION = 1;

/** Positions read in on-screen order: row 1 (0-3), row 2 (4, [counter], 5), row 3 (6-9). */
export const LUCKY_RING_CELL_COUNT = 10;

export const LUCKY_RING_BETTING_MS = 15_000;
export const LUCKY_RING_SPIN_MS = 4_500;
/** How long the settled result (winning cell + win/lose banner) is held on
 *  screen before the next BETTING round opens. */
export const LUCKY_RING_SETTLED_DISPLAY_MS = 3_000;

/** Bet chip amounts, matching the reference cabinet's 100 / 1K / 10K / 50K row. */
export const LUCKY_RING_BETS = [100, 1_000, 10_000, 50_000] as const;

/** Absolute cap on a single bet's payout — defense in depth, mirrors lucky.config's maxPayout. */
export const LUCKY_RING_MAX_PAYOUT = 5_000_000;

export interface LuckyRingCell {
  /** 0-9, board position (see layout comment above). */
  index: number;
  symbol: LuckySymbolId;
  /** Multiplier paid on the bet amount when this cell wins. */
  multiplier: number;
  /** RNG weight. Chosen as k/multiplier so every cell carries the same
   *  expected-value ratio (~95% RTP) — no cell is a statistically better or
   *  worse bet than another; only the variance differs. */
  weight: number;
}

// weight = 900 / multiplier (rounded), so probability * multiplier is
// constant across all cells => uniform ~95.1% RTP (900 / 946) per cell,
// independent of which cell a player picks.
export const LUCKY_RING_CELLS: LuckyRingCell[] = [
  { index: 0, symbol: "orange", multiplier: 5, weight: 180 },
  { index: 1, symbol: "lemon", multiplier: 5, weight: 180 },
  { index: 2, symbol: "grapes", multiplier: 5, weight: 180 },
  { index: 3, symbol: "cherry", multiplier: 5, weight: 180 },
  { index: 4, symbol: "lucky", multiplier: 88, weight: 10 },
  { index: 5, symbol: "lucky", multiplier: 88, weight: 10 },
  { index: 6, symbol: "apple", multiplier: 10, weight: 90 },
  { index: 7, symbol: "watermelon", multiplier: 15, weight: 60 },
  { index: 8, symbol: "mango", multiplier: 25, weight: 36 },
  { index: 9, symbol: "strawberry", multiplier: 45, weight: 20 },
];

export const LUCKY_RING_TOTAL_WEIGHT = LUCKY_RING_CELLS.reduce((sum, c) => sum + c.weight, 0);

export function luckyRingCellByIndex(index: number): LuckyRingCell {
  const cell = LUCKY_RING_CELLS[index];
  if (!cell) throw new Error(`Invalid lucky_ring cell index: ${index}`);
  return cell;
}

export function isLuckyRingBetAllowed(amount: number): boolean {
  return (LUCKY_RING_BETS as readonly number[]).includes(amount);
}