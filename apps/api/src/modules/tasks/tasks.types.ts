import type { Database } from "../../types/database.types";

export type DailyTask =
  Database["public"]["Tables"]["daily_tasks"]["Row"];

export type UserTaskClaim =
  Database["public"]["Tables"]["user_task_claims"]["Row"];

export interface TaskProgress {
  progress: number;
  targetCount: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface TaskReward {
  coins: number;
  diamonds: number;
  exp: number;
}

export interface TaskItem {
  id: string;
  title: string;
  type: string | null;
  icon: string | null;
  targetCount: number;

  reward: TaskReward;

  progress: TaskProgress;
}

export interface TasksResult {
  tasks: TaskItem[];
}

export interface AdminTaskItem {
  id: string;
  title: string;
  description: string | null;
  durationType: string;
  icon: string | null;
  targetCount: number;
  targetGender: string;
  status: string;
  expiryDate: string | null;
  reward: TaskReward;
  createdAt: string;
  updatedAt: string;
  stats: {
    assignedUsers: number;
    completedUsers: number;
    claimedUsers: number;
  };
}

export interface ClaimTaskResult {
  taskId: string;

  reward: TaskReward;

  newCoins: number;
  newDiamonds: number;
}