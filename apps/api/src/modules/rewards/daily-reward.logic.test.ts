import { describe, expect, it } from "vitest";
import {
  computeDailyRewardState,
  dayIndexOfStreak,
  previousDayString,
  utcDayString,
} from "./daily-reward.logic";

describe("utcDayString / previousDayString", () => {
  it("formats a UTC date as YYYY-MM-DD", () => {
    expect(utcDayString(new Date("2026-10-03T04:00:00.000Z"))).toBe("2026-10-03");
  });

  it("computes the previous day across month boundaries", () => {
    expect(previousDayString("2026-10-01")).toBe("2026-09-30");
    expect(previousDayString("2026-03-01")).toBe("2026-02-28");
  });
});

describe("dayIndexOfStreak", () => {
  it("cycles 1..cycleLength", () => {
    expect(dayIndexOfStreak(1, 7)).toBe(1);
    expect(dayIndexOfStreak(7, 7)).toBe(7);
    expect(dayIndexOfStreak(8, 7)).toBe(1);
    expect(dayIndexOfStreak(15, 7)).toBe(1);
  });

  it("handles a degenerate cycle length", () => {
    expect(dayIndexOfStreak(3, 0)).toBe(1);
  });
});

describe("computeDailyRewardState", () => {
  const today = "2026-10-03";

  it("reports already-claimed when lastClaimDate is today", () => {
    const state = computeDailyRewardState(today, 3, today, 7);
    expect(state).toEqual({ alreadyClaimed: true, dayIndex: 3, currentStreak: 3 });
  });

  it("continues a streak from yesterday", () => {
    const state = computeDailyRewardState("2026-10-02", 2, today, 7);
    expect(state.alreadyClaimed).toBe(false);
    if (!state.alreadyClaimed) {
      expect(state.newStreak).toBe(3);
      expect(state.dayIndex).toBe(3);
    }
  });

  it("resets the streak after a missed day", () => {
    const state = computeDailyRewardState("2026-09-30", 5, today, 7);
    expect(state.alreadyClaimed).toBe(false);
    if (!state.alreadyClaimed) {
      expect(state.newStreak).toBe(1);
      expect(state.dayIndex).toBe(1);
    }
  });

  it("starts a fresh streak when there is no prior claim", () => {
    const state = computeDailyRewardState(null, 0, today, 7);
    expect(state.alreadyClaimed).toBe(false);
    if (!state.alreadyClaimed) {
      expect(state.newStreak).toBe(1);
      expect(state.dayIndex).toBe(1);
    }
  });

  it("wraps a 7-day streak back to day 1 on the 8th consecutive day", () => {
    // last claim yesterday with streak 7 -> today is day 8 -> day index 1
    const state = computeDailyRewardState("2026-10-02", 7, today, 7);
    if (!state.alreadyClaimed) {
      expect(state.newStreak).toBe(8);
      expect(state.dayIndex).toBe(1);
    }
  });
});
