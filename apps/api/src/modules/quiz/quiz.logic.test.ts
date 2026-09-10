import { describe, expect, it } from "vitest";
import {
  computeAnswerPoints,
  computeStreakBonus,
  computeWinners,
  isLastQuestion,
  nextStreak,
  rankPlayers,
} from "./quiz.logic";
import { QUIZ_BASE_POINTS, QUIZ_MAX_SPEED_BONUS, QUIZ_STREAK_BONUS } from "./quiz.types";

describe("computeAnswerPoints", () => {
  it("awards zero for an incorrect answer regardless of timing", () => {
    expect(computeAnswerPoints(false, 15_000, 15_000)).toBe(0);
    expect(computeAnswerPoints(false, 0, 15_000)).toBe(0);
  });

  it("awards base + full speed bonus for an instant correct answer", () => {
    expect(computeAnswerPoints(true, 15_000, 15_000)).toBe(QUIZ_BASE_POINTS + QUIZ_MAX_SPEED_BONUS);
  });

  it("awards only base points for a correct answer at the deadline", () => {
    expect(computeAnswerPoints(true, 0, 15_000)).toBe(QUIZ_BASE_POINTS);
  });

  it("decays the speed bonus linearly with remaining time", () => {
    const half = computeAnswerPoints(true, 7_500, 15_000);
    expect(half).toBe(QUIZ_BASE_POINTS + Math.round(QUIZ_MAX_SPEED_BONUS / 2));
  });

  it("clamps remaining time so it never exceeds the question duration", () => {
    // A late/duplicate clock read shouldn't award more than the max bonus.
    expect(computeAnswerPoints(true, 999_999, 15_000)).toBe(QUIZ_BASE_POINTS + QUIZ_MAX_SPEED_BONUS);
  });

  it("never returns a negative score for a negative remaining time", () => {
    expect(computeAnswerPoints(true, -500, 15_000)).toBe(QUIZ_BASE_POINTS);
  });
});

describe("nextStreak / computeStreakBonus", () => {
  it("resets to 0 on an incorrect answer", () => {
    expect(nextStreak(4, false)).toBe(0);
  });

  it("increments by 1 on a correct answer", () => {
    expect(nextStreak(0, true)).toBe(1);
    expect(nextStreak(3, true)).toBe(4);
  });

  it("gives no bonus for the first hit in a streak", () => {
    expect(computeStreakBonus(1)).toBe(0);
    expect(computeStreakBonus(0)).toBe(0);
  });

  it("scales the bonus with streak length beyond the first hit", () => {
    expect(computeStreakBonus(2)).toBe(QUIZ_STREAK_BONUS);
    expect(computeStreakBonus(4)).toBe(3 * QUIZ_STREAK_BONUS);
  });
});

describe("rankPlayers", () => {
  it("sorts by score descending", () => {
    const ranked = rankPlayers([
      { userId: "a", score: 50 },
      { userId: "b", score: 200 },
      { userId: "c", score: 100 },
    ]);
    expect(ranked.map((p) => p.userId)).toEqual(["b", "c", "a"]);
  });

  it("keeps original relative order for tied scores (stable sort)", () => {
    const ranked = rankPlayers([
      { userId: "first", score: 100 },
      { userId: "second", score: 100 },
    ]);
    expect(ranked.map((p) => p.userId)).toEqual(["first", "second"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { userId: "a", score: 1 },
      { userId: "b", score: 2 },
    ];
    const copy = [...input];
    rankPlayers(input);
    expect(input).toEqual(copy);
  });
});

describe("computeWinners", () => {
  it("declares the single top scorer the winner", () => {
    const ranked = rankPlayers([
      { userId: "a", score: 50 },
      { userId: "b", score: 200 },
    ]);
    expect(computeWinners(ranked)).toEqual(new Set(["b"]));
  });

  it("declares a tie for the top score as co-winners", () => {
    const ranked = rankPlayers([
      { userId: "a", score: 100 },
      { userId: "b", score: 100 },
      { userId: "c", score: 40 },
    ]);
    expect(computeWinners(ranked)).toEqual(new Set(["a", "b"]));
  });

  it("declares no winner when every score is zero", () => {
    const ranked = rankPlayers([
      { userId: "a", score: 0 },
      { userId: "b", score: 0 },
    ]);
    expect(computeWinners(ranked).size).toBe(0);
  });

  it("declares no winner for an empty player list", () => {
    expect(computeWinners([]).size).toBe(0);
  });
});

describe("isLastQuestion", () => {
  it("is true on the final index", () => {
    expect(isLastQuestion(4, 5)).toBe(true);
  });

  it("is false before the final index", () => {
    expect(isLastQuestion(0, 5)).toBe(false);
    expect(isLastQuestion(3, 5)).toBe(false);
  });
});
