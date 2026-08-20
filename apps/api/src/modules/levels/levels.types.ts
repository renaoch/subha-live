import type { Database } from "../../types/database.types";

export type LevelDefinition =
  Database["public"]["Tables"]["level_definitions"]["Row"];

export type LevelReward =
  Database["public"]["Tables"]["level_rewards"]["Row"];

export type UserLevelProgress =
  Database["public"]["Tables"]["user_level_progress"]["Row"];

export type UserLevelHistory =
  Database["public"]["Tables"]["user_level_history"]["Row"];

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

export interface LevelRewardItem {
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

export interface LevelOverview {
  progress: LevelProgress;
}

export interface LevelRewardsResult {
  rewards: LevelRewardItem[];
}

export interface LevelHistoryResult {
  history: LevelHistoryItem[];
}