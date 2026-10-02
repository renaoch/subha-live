// Daily reward types. daily_reward_* tables post-date the last
// `supabase gen types` run, so these are hand-written (same convention as
// host-task.types.ts / pk.types.ts).

export interface DailyRewardDefinition {
  dayIndex: number;
  rewardCoins: number;
  rewardXp: number;
  rewardType: "coins";
  isActive: boolean;
}

export interface DailyRewardClaim {
  id: string;
  dayIndex: number;
  rewardDate: string;
  streak: number;
  rewardCoins: number;
  rewardXp: number;
  createdAt: string;
}

/** Schedule + the user's status, for rendering the calendar. */
export interface DailyRewardOverview {
  /** UTC day strings for the current cycle, oldest first. */
  cycleLength: number;
  schedule: DailyRewardDefinition[];
  today: string;
  /** Days already claimed in the current cycle (1-based indexes). */
  claimedDays: number[];
  currentStreak: number;
  longestStreak: number;
  /** 1-based day index that today's claim would grant. */
  todayDayIndex: number;
  alreadyClaimedToday: boolean;
  /** The UTC date the next claim window opens (or today if claimable). */
  nextClaimAt: string;
  /** Authoritative current coin balance. */
  coins: number;
}

export interface DailyRewardClaimResult {
  alreadyProcessed: boolean;
  claimId: string;
  dayIndex: number;
  rewardCoins: number;
  rewardXp: number;
  newCoins: number;
  newStreak: number;
}
