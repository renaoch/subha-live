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

/**
 * Actual backend response:
 *
 * {
 *   status: "ok",
 *   level: {
 *     currentLevel: 150,
 *     currentXp: 0,
 *     ...
 *   }
 * }
 */
interface LevelOverviewResponse {
  status: string;
  level: LevelProgress;
}

/**
 * Actual backend response:
 *
 * {
 *   status: "ok",
 *   rewards: [...]
 * }
 */
interface LevelRewardsResponse {
  status: string;
  rewards: LevelReward[];
}

/**
 * Actual backend response:
 *
 * {
 *   status: "ok",
 *   history: [...]
 * }
 */
interface LevelHistoryResponse {
  status: string;
  history: LevelHistoryItem[];
}

export const levelsApi = {
  async me(): Promise<{
    progress: LevelProgress;
  }> {
    const response =
      await apiFetch<LevelOverviewResponse>(
        "/api/v1/levels/me",
      );

    console.log(
      "LEVEL API /me:",
      response,
    );

    return {
      progress: response.level,
    };
  },

  async rewards(): Promise<LevelReward[]> {
    const response =
      await apiFetch<LevelRewardsResponse>(
        "/api/v1/levels/rewards",
      );

    return response.rewards;
  },

  async history(
    limit = 20,
    offset = 0,
  ): Promise<LevelHistoryItem[]> {
    const response =
      await apiFetch<LevelHistoryResponse>(
        `/api/v1/levels/history?limit=${limit}&offset=${offset}`,
      );

    return response.history;
  },
};