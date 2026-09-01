import { describe, expect, it } from "vitest";
import {
  canTransition,
  assertTransition,
  isScoreable,
  isTerminal,
  PkStateError,
} from "./pk.state";
import {
  winnerOf,
  sideOf,
  winnerHostId,
  computeRemainingMs,
  applyScore,
  type ScoreModel,
} from "./pk.logic";

describe("PK state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("IDLE", "INVITED")).toBe(true);
    expect(canTransition("INVITED", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "STARTING")).toBe(true);
    expect(canTransition("STARTING", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "FINALIZING")).toBe(true);
    expect(canTransition("FINALIZING", "FINISHED")).toBe(true);
  });

  it("allows cancellation from pre-terminal states", () => {
    expect(canTransition("INVITED", "CANCELLED")).toBe(true);
    expect(canTransition("ACCEPTED", "CANCELLED")).toBe(true);
    expect(canTransition("ACTIVE", "CANCELLED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("FINISHED", "ACTIVE")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransition("ACTIVE", "STARTING")).toBe(false);
    expect(canTransition("FINISHED", "FINALIZING")).toBe(false);
    expect(canTransition("IDLE", "ACTIVE")).toBe(false);
  });

  it("throws a typed error on invalid transition", () => {
    expect(() => assertTransition("FINISHED", "ACTIVE")).toThrow(PkStateError);
  });

  it("only ACTIVE is scoreable; terminal states are terminal", () => {
    expect(isScoreable("ACTIVE")).toBe(true);
    expect(isScoreable("FINALIZING")).toBe(false);
    expect(isScoreable("FINISHED")).toBe(false);
    expect(isScoreable("CANCELLED")).toBe(false);
    expect(isTerminal("FINISHED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("ACTIVE")).toBe(false);
  });
});

describe("winner / side", () => {
  it("determines A win, B win and DRAW", () => {
    expect(winnerOf(15000, 14300)).toBe("A");
    expect(winnerOf(10, 20)).toBe("B");
    expect(winnerOf(100, 100)).toBe("DRAW");
  });

  it("maps side and winner host id", () => {
    expect(sideOf("hostA", "hostB", "hostA")).toBe("A");
    expect(sideOf("hostA", "hostB", "hostB")).toBe("B");
    expect(winnerHostId("hostA", "hostB", "A")).toBe("hostA");
    expect(winnerHostId("hostA", "hostB", "B")).toBe("hostB");
    expect(winnerHostId("hostA", "hostB", "DRAW")).toBeNull();
  });

  it("computes remaining time (clamped, null when no end)", () => {
    expect(computeRemainingMs(1000, 500)).toBe(500);
    expect(computeRemainingMs(1000, 2000)).toBe(0);
    expect(computeRemainingMs(null, 500)).toBeNull();
  });
});

describe("score application (mirrors the atomic Lua script)", () => {
  function model(): ScoreModel {
    return { status: "ACTIVE", scoreA: 0, scoreB: 0, version: 0, seenGiftIds: new Set() };
  }

  it("sums a single gift correctly", () => {
    const m = model();
    const r = applyScore(m, "A", "g1", 500);
    expect(r).toEqual({ applied: true, scoreA: 500, scoreB: 0, version: 1 });
  });

  it("many concurrent gifts sum to exactly the total (integer arithmetic)", () => {
    const m = model();
    const gifts: Array<[side: "A" | "B", id: string, value: number]> = [
      ["A", "a1", 500],
      ["B", "b1", 1000],
      ["A", "a2", 200],
      ["B", "b2", 50],
      ["A", "a3", 12345],
      ["B", "b3", 7],
    ];
    let totalA = 0;
    let totalB = 0;
    for (const [side, id, value] of gifts) {
      applyScore(m, side, id, value);
      if (side === "A") totalA += value;
      else totalB += value;
    }
    expect(m.scoreA).toBe(totalA);
    expect(m.scoreB).toBe(totalB);
    expect(m.version).toBe(gifts.length);
  });

  it("duplicate gift transaction ids are not counted twice", () => {
    const m = model();
    applyScore(m, "A", "dup", 500);
    const second = applyScore(m, "A", "dup", 500);
    expect(second).toEqual({ applied: false, reason: "duplicate" });
    expect(m.scoreA).toBe(500);
    expect(m.version).toBe(1);
  });

  it("rejects gifts when not ACTIVE", () => {
    const m = model();
    m.status = "FINALIZING";
    expect(applyScore(m, "A", "g1", 500)).toEqual({ applied: false, reason: "not_active" });
    expect(m.scoreA).toBe(0);
    expect(m.scoreB).toBe(0);
  });

  it("handles large values without floating point drift", () => {
    const m = model();
    applyScore(m, "A", "big", 9_007_199_254_740_991); // Number.MAX_SAFE_INTEGER
    expect(m.scoreA).toBe(9_007_199_254_740_991);
  });
});
