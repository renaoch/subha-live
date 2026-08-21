import { apiFetch } from "@/lib/api/client";

export interface TaskReward {
  coins: number;
  diamonds: number;
  exp: number;
}

export interface TaskProgress {
  progress: number;
  targetCount: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  icon: string | null;
  targetCount: number;
  reward: TaskReward;
  progress: TaskProgress;
}

export interface ClaimTaskResult {
  taskId: string;
  reward: TaskReward;
  newCoins: number;
  newDiamonds: number;
}

interface TasksResponse {
  status: string;
  tasks: TaskItem[];
}

interface ClaimTaskResponse {
  status: string;
  task: ClaimTaskResult;
}

export const tasksApi = {
  async list(): Promise<TaskItem[]> {
    const data = await apiFetch<TasksResponse>(
      "/api/v1/tasks",
    );

    return data.tasks;
  },

  async claim(
    taskId: string,
  ): Promise<ClaimTaskResult> {
    const data =
      await apiFetch<ClaimTaskResponse>(
        `/api/v1/tasks/${taskId}/claim`,
        {
          method: "POST",
        },
      );

    return data.task;
  },
};