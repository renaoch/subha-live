// File: apps/web/lib/api/rewards.ts
//
// Client for the Daily Rewards / check-in system. The server is authoritative:
// it resolves the UTC reward day, streak, and reward amount — this client only
// reads the overview and issues an idempotent claim.

import { apiFetch } from "@/lib/api/client";

interface RewardsEnvelope<T> {
  success: boolean;
  data: T;
}

export interface DailyRewardDefinition {
  dayIndex: number;
  rewardCoins: number;
  rewardXp: number;
  rewardType: "coins";
  isActive: boolean;
}

export interface DailyRewardOverview {
  cycleLength: number;
  schedule: DailyRewardDefinition[];
  today: string;
  claimedDays: number[];
  currentStreak: number;
  longestStreak: number;
  todayDayIndex: number;
  alreadyClaimedToday: boolean;
  nextClaimAt: string;
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

export interface DailyRewardClaim {
  id: string;
  dayIndex: number;
  rewardDate: string;
  streak: number;
  rewardCoins: number;
  rewardXp: number;
  createdAt: string;
}

export const rewardsApi = {
  overview() {
    return apiFetch<RewardsEnvelope<DailyRewardOverview>>("/api/v1/rewards/daily").then(
      (r) => r.data,
    );
  },

  claim() {
    return apiFetch<RewardsEnvelope<DailyRewardClaimResult>>("/api/v1/rewards/daily/claim", {
      method: "POST",
    }).then((r) => r.data);
  },

  history(limit = 30) {
    return apiFetch<RewardsEnvelope<DailyRewardClaim[]>>(
      `/api/v1/rewards/daily/history?limit=${limit}`,
    ).then((r) => r.data);
  },
};
