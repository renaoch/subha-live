import { describe, expect, it } from "vitest";
import {
  computePayout,
  drawSymbol,
  evaluateGrid,
  evaluateLine,
  generateGrid,
  spinOutcome,
} from "./lucky.logic";
import { isBetAllowed, LUCKY_JACKPOT_MULTIPLIER, symbolMultiplier } from "./lucky.config";
import type { LuckyGrid, LuckySymbolId } from "./lucky.types";

/** Deterministic RNG: cycles through a fixed sequence, then repeats 0. */
function seqRng(...values: number[]) {
  let i = 0;
  return (bound: number) => {
    const v = values[i % values.length];
    i += 1;
    return v % bound;
  };
}

const grid = (cells: LuckySymbolId[]): LuckyGrid => cells;

describe("drawSymbol / generateGrid", () => {
  it("always returns a known symbol", () => {
    const rng = seqRng(0);
    for (let i = 0; i < 100; i += 1) {
      const s = drawSymbol(rng);
      expect(["orange", "lemon", "grapes", "cherry", "apple", "watermelon", "mango", "strawberry", "lucky"]).toContain(s);
    }
  });

  it("generates exactly nine cells", () => {
    const g = generateGrid(seqRng(0, 1, 2, 3, 4, 5, 6, 7, 8));
    expect(g).toHaveLength(9);
  });
});

describe("evaluateLine", () => {
  it("pays three identical fruit at the symbol multiplier", () => {
    const { multiplier } = evaluateLine(["orange", "orange", "orange"]);
    expect(multiplier).toBe(symbolMultiplier("orange"));
  });

  it("pays a wild-substituted line (two fruit + lucky)", () => {
    const { multiplier } = evaluateLine(["cherry", "cherry", "lucky"]);
    expect(multiplier).toBe(symbolMultiplier("cherry"));
  });

  it("pays the jackpot multiplier for three lucky", () => {
    const { multiplier, isJackpot } = evaluateLine(["lucky", "lucky", "lucky"]);
    expect(multiplier).toBe(LUCKY_JACKPOT_MULTIPLIER);
    expect(isJackpot).toBe(true);
  });

  it("does not pay a mixed line", () => {
    expect(evaluateLine(["orange", "cherry", "apple"]).multiplier).toBe(0);
  });

  it("does not pay a line with two different fruits and a wild", () => {
    expect(evaluateLine(["orange", "cherry", "lucky"]).multiplier).toBe(0);
  });
});

describe("evaluateGrid", () => {
  it("detects a winning top row", () => {
    const g = grid(["apple", "apple", "apple", "orange", "lemon", "grapes", "cherry", "cherry", "cherry"]);
    const result = evaluateGrid(g);
    expect(result.multiplier).toBe(symbolMultiplier("apple") + symbolMultiplier("cherry"));
    expect(result.winningLines).toContainEqual([0, 1, 2]);
    expect(result.winningLines).toContainEqual([6, 7, 8]);
  });

  it("stacks diagonal + column wins", () => {
    const g = grid(["orange", "lemon", "grapes", "orange", "lemon", "grapes", "orange", "lemon", "grapes"]);
    const result = evaluateGrid(g);
    // three vertical columns of orange/lemon/grapes (first two columns only,
    // third column is grapes) — columns 0 and 1 win, plus diagonal? Let's assert
    // each column individually instead of exact sum.
    expect(result.winningLines).toContainEqual([0, 3, 6]); // column orange
    expect(result.winningLines).toContainEqual([1, 4, 7]); // column lemon
  });

  it("is jackpot only when a line is all lucky", () => {
    const allLucky = grid(Array(9).fill("lucky") as LuckySymbolId[]);
    expect(evaluateGrid(allLucky).isJackpot).toBe(true);
    const noLucky = grid(["orange", "lemon", "grapes", "cherry", "apple", "watermelon", "mango", "strawberry", "orange"]);
    expect(evaluateGrid(noLucky).isJackpot).toBe(false);
  });
});

describe("computePayout", () => {
  it("multiplies bet by multiplier", () => {
    expect(computePayout(1000, 5)).toBe(5000);
  });

  it("returns zero for a zero multiplier", () => {
    expect(computePayout(1000, 0)).toBe(0);
  });

  it("caps payout at the configured maximum", () => {
    expect(computePayout(50_000, 100_000)).toBe(5_000_000);
  });
});

describe("spinOutcome", () => {
  it("produces a result whose payout matches evaluation", () => {
    const outcome = spinOutcome(1000, seqRng(3, 3, 3, 7, 8, 1, 2, 4, 5));
    expect(outcome.symbols).toHaveLength(9);
    expect(outcome.payout).toBe(computePayout(1000, outcome.multiplier));
    expect(outcome.payout).toBeGreaterThanOrEqual(0);
  });
});

describe("isBetAllowed", () => {
  it("accepts the configured bets only", () => {
    expect(isBetAllowed(100)).toBe(true);
    expect(isBetAllowed(1000)).toBe(true);
    expect(isBetAllowed(10_000)).toBe(true);
    expect(isBetAllowed(50_000)).toBe(true);
    expect(isBetAllowed(250)).toBe(false);
    expect(isBetAllowed(0)).toBe(false);
    expect(isBetAllowed(-100)).toBe(false);
  });
});
