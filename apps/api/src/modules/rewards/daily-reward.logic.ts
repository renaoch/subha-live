// Daily reward — pure, side-effect-free logic. The authoritative reward-day
// boundary is the UTC calendar day (`YYYY-MM-DD`). Streak + day-index math live
// here so the rules are unit-testable without a DB, same pattern as
// host-task.logic.ts / pk.logic.ts.

export interface DailyRewardDefinition {
  dayIndex: number;
  rewardCoins: number;
  rewardXp: number;
  isActive: boolean;
}

/** The official reward day (UTC) as a `YYYY-MM-DD` string. */
export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The previous UTC day as `YYYY-MM-DD`. */
export function previousDayString(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return utcDayString(date);
}

/** Map a streak (>=1) onto its position in the reward cycle (1-based). */
export function dayIndexOfStreak(streak: number, cycleLength: number): number {
  if (cycleLength <= 0) return 1;
  const safe = Math.max(1, streak);
  return ((safe - 1) % cycleLength) + 1;
}

export type DailyRewardState =
  | {
      alreadyClaimed: true;
      /** The day (in the cycle) that was claimed today. */
      dayIndex: number;
      currentStreak: number;
    }
  | {
      alreadyClaimed: false;
      /** The day (in the cycle) that today's claim will grant. */
      dayIndex: number;
      /** The streak value AFTER today's claim. */
      newStreak: number;
      /** The streak value before today's claim. */
      currentStreak: number;
    };

/**
 * Derive today's claim state from the stored streak. `lastClaimDate` and
 * `currentStreak` come from daily_reward_streaks; `today` is the server's UTC
 * day. `currentStreak` counts consecutive days ending at `lastClaimDate`.
 */
export function computeDailyRewardState(
  lastClaimDate: string | null,
  currentStreak: number,
  today: string,
  cycleLength: number,
): DailyRewardState {
  if (lastClaimDate === today) {
    return {
      alreadyClaimed: true,
      dayIndex: dayIndexOfStreak(currentStreak, cycleLength),
      currentStreak,
    };
  }

  const isConsecutive = lastClaimDate !== null && lastClaimDate === previousDayString(today);
  const newStreak = isConsecutive ? currentStreak + 1 : 1;

  return {
    alreadyClaimed: false,
    dayIndex: dayIndexOfStreak(newStreak, cycleLength),
    newStreak,
    currentStreak,
  };
}
