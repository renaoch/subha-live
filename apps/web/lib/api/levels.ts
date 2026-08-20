import { apiFetch } from "@/lib/api/client";

export interface LevelProgress {
  currentLevel: number;
  currentXp: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progress: number;
  nextLevel: number | null;
  currentTitle: string | null;
  nextTitle: string | null;
}

export interface LevelOverview {
  progress: LevelProgress;
}

export interface LevelReward {
  id: string;
  level: number;
  rewardType: string;
  rewardAmount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LevelHistoryItem {
  id: string;
  oldLevel: number;
  newLevel: number;
  xpAtLevelUp: number;
  createdAt: string;
}

interface LevelOverviewResponse {
  status: string;
  progress: LevelProgress;
}

interface LevelRewardsResponse {
  status: string;
  rewards: LevelReward[];
}

interface LevelHistoryResponse {
  status: string;
  history: LevelHistoryItem[];
}

export const levelsApi = {
  me() {
    return apiFetch<LevelOverviewResponse>(
      "/api/v1/levels/me",
    ).then((response) => ({
      progress: response.progress,
    }));
  },

  rewards() {
    return apiFetch<LevelRewardsResponse>(
      "/api/v1/levels/rewards",
    ).then((response) => response.rewards);
  },

  history(limit = 20, offset = 0) {
    return apiFetch<LevelHistoryResponse>(
      `/api/v1/levels/history?limit=${limit}&offset=${offset}`,
    ).then((response) => response.history);
  },
};