// Lucky Ring — pure, side-effect-free game logic. No I/O, no crypto, no DB.
// The service layer injects the real crypto RNG; tests inject a fake one.

import { LUCKY_RING_CELLS, LUCKY_RING_MAX_PAYOUT, luckyRingCellByIndex } from "./lucky-ring.config";

export type Rng = (bound: number) => number;

const CUMULATIVE: number[] = (() => {
  let total = 0;
  return LUCKY_RING_CELLS.map((c) => (total += c.weight));
})();
const TOTAL_WEIGHT = CUMULATIVE[CUMULATIVE.length - 1] ?? 1;

/** Draw the winning cell index (0-9) according to the configured weights. */
export function drawWinningCell(rng: Rng): number {
  const roll = rng(TOTAL_WEIGHT);
  for (let i = 0; i < CUMULATIVE.length; i++) {
    if (roll < CUMULATIVE[i]) return LUCKY_RING_CELLS[i].index;
  }
  return LUCKY_RING_CELLS[LUCKY_RING_CELLS.length - 1].index;
}

/** Payout for one bet, capped at LUCKY_RING_MAX_PAYOUT (defense in depth). */
export function computeCellPayout(betAmount: number, cellIndex: number): number {
  const cell = luckyRingCellByIndex(cellIndex);
  return Math.min(betAmount * cell.multiplier, LUCKY_RING_MAX_PAYOUT);
}