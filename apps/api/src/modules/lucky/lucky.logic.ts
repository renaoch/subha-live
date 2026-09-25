// Subha Lucky — pure, side-effect-free game logic.
//
// No I/O, no crypto, no DB. The result generation + payout evaluation are the
// single source of truth for what a spin can produce; the service layer feeds
// these into fin_lucky_spin() (the atomic economic settlement) and both the
// production RNG and the tests inject their own randomness through `rng`.
//
// The CLIENT never calls this — it only receives the authoritative result and
// animates it.

import { LUCKY_GRID_SIZE } from "./lucky.types";
import type { LuckyGrid, LuckyResult, LuckySymbolId } from "./lucky.types";
import {
  LUCKY_JACKPOT_MULTIPLIER,
  LUCKY_MAX_PAYOUT,
  LUCKY_PAYLINES,
  LUCKY_WEIGHTS,
  symbolMultiplier,
} from "./lucky.config";

/** A function returning a uniformly-distributed integer in [0, bound). */
export type Rng = (bound: number) => number;

const ALL_SYMBOLS = Object.keys(LUCKY_WEIGHTS) as LuckySymbolId[];

function buildCumulativeWeights(): { ids: LuckySymbolId[]; cumulative: number[] } {
  let total = 0;
  const cumulative: number[] = [];
  for (const id of ALL_SYMBOLS) {
    total += LUCKY_WEIGHTS[id];
    cumulative.push(total);
  }
  return { ids: ALL_SYMBOLS, cumulative };
}

const { ids: WEIGHTED_IDS, cumulative: WEIGHTED_CUMULATIVE } = buildCumulativeWeights();
const WEIGHTED_TOTAL = WEIGHTED_CUMULATIVE[WEIGHTED_CUMULATIVE.length - 1] ?? 1;

/**
 * Draw one symbol according to the server-side weights. `rng` returns an int in
 * [0, bound); production passes a crypto-bound RNG (crypto.randomInt), tests
 * pass a deterministic one.
 */
export function drawSymbol(rng: Rng): LuckySymbolId {
  const roll = rng(WEIGHTED_TOTAL);
  for (let i = 0; i < WEIGHTED_CUMULATIVE.length; i += 1) {
    if (roll < WEIGHTED_CUMULATIVE[i]) return WEIGHTED_IDS[i];
  }
  return WEIGHTED_IDS[WEIGHTED_IDS.length - 1];
}

/** Generate a full 3x3 grid (9 independent draws). */
export function generateGrid(rng: Rng): LuckyGrid {
  const grid: LuckySymbolId[] = [];
  for (let i = 0; i < LUCKY_GRID_SIZE; i += 1) {
    grid.push(drawSymbol(rng));
  }
  return grid;
}

/**
 * Evaluate a line of three symbols.
 *  - three identical fruit => that fruit's multiplier;
 *  - two identical fruit + one Lucky wild => that fruit's multiplier;
 *  - three Lucky => the jackpot multiplier.
 * Returns 0 when the line does not win.
 */
export function evaluateLine(line: LuckySymbolId[]): { multiplier: number; isJackpot: boolean } {
  if (line.length !== 3) return { multiplier: 0, isJackpot: false };

  const luckyCount = line.filter((s) => s === "lucky").length;
  if (luckyCount === 3) {
    return { multiplier: LUCKY_JACKPOT_MULTIPLIER, isJackpot: true };
  }

  // Non-lucky symbols must all match (and there must be no more than one
  // distinct fruit) for a wild-substituted win.
  const fruits = line.filter((s) => s !== "lucky");
  const distinct = new Set(fruits);
  if (fruits.length > 0 && distinct.size === 1) {
    const base = fruits[0];
    return { multiplier: symbolMultiplier(base), isJackpot: false };
  }

  return { multiplier: 0, isJackpot: false };
}

/**
 * Evaluate the full grid across every payline. Line wins stack (sum of
 * multipliers). `isJackpot` is true when any line is all-Lucky.
 */
export function evaluateGrid(grid: LuckyGrid): {
  multiplier: number;
  winningLines: number[][];
  isJackpot: boolean;
} {
  let multiplier = 0;
  const winningLines: number[][] = [];
  let isJackpot = false;

  for (const line of LUCKY_PAYLINES) {
    const result = evaluateLine(line.map((i) => grid[i]));
    if (result.multiplier > 0) {
      multiplier += result.multiplier;
      winningLines.push(line);
      if (result.isJackpot) isJackpot = true;
    }
  }

  return { multiplier, winningLines, isJackpot };
}

/** Payout = bet x total multiplier, clamped to the config cap. */
export function computePayout(bet: number, multiplier: number): number {
  const raw = bet * multiplier;
  return Math.min(raw, LUCKY_MAX_PAYOUT);
}

/**
 * Produce a complete authoritative result for a bet. This is the ONLY entry
 * point the service layer uses — the outcome is fully determined here (given
 * an RNG), never by the client.
 */
export function spinOutcome(bet: number, rng: Rng): LuckyResult {
  const symbols = generateGrid(rng);
  const { multiplier, winningLines, isJackpot } = evaluateGrid(symbols);
  const payout = computePayout(bet, multiplier);
  return { symbols, multiplier, payout, winningLines, isJackpot };
}
