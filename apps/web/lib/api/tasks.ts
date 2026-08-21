// File: lib/api/tasks.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

class TasksApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new TasksApiError(
      body?.message || body?.error || `Request failed (${res.status})`,
    );
  }

  return (await res.json()) as T;
}

export const tasksApi = {
  async list(): Promise<TaskItem[]> {
    const data = await request<{ status: string; tasks: TaskItem[] }>(
      "/api/v1/tasks",
    );
    return data.tasks;
  },

  async claim(taskId: string): Promise<ClaimTaskResult> {
    const data = await request<{ status: string; task: ClaimTaskResult }>(
      `/api/v1/tasks/${taskId}/claim`,
      { method: "POST" },
    );
    return data.task;
  },
};