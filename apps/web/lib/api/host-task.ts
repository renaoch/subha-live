import { apiFetch } from "@/lib/api/client";

interface HostTaskEnvelope<T> {
  success: boolean;
  data: T;
}

export type HostTaskAudience = "all" | "new_users" | "existing_users";
export type HostTaskStatus = "active" | "inactive" | "ended";
export type ViewerTaskState =
  | "expired"
  | "not_eligible"
  | "active"
  | "in_progress"
  | "completed"
  | "claimed";

export interface HostTaskConfig {
  id: string;
  roomId: string;
  createdBy: string;
  title: string;
  description: string;
  audience: HostTaskAudience;
  newUserWindowDays: number;
  targetHours: number | null;
  targetCoins: number | null;
  rewardAmount: number;
  startsAt: string | null;
  expiresAt: string | null;
  maxClaims: number | null;
  status: HostTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerHostTask extends HostTaskConfig {
  state: ViewerTaskState;
  progress: {
    hours: number;
    coins: number;
    percent: number;
  };
  remainingMs: number | null;
  claimedAt: string | null;
}

export interface HostTaskStats {
  eligibleUsers: number;
  completedUsers: number;
  claimedUsers: number;
}

export interface HostTaskWithStats extends HostTaskConfig {
  stats: HostTaskStats;
}

export interface CreateHostTaskInput {
  title: string;
  description?: string;
  audience?: HostTaskAudience;
  newUserWindowDays?: number;
  targetHours?: number;
  targetCoins?: number;
  rewardAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  maxClaims?: number;
}

export interface UpdateHostTaskInput {
  title?: string;
  description?: string;
  audience?: HostTaskAudience;
  newUserWindowDays?: number;
  targetHours?: number;
  targetCoins?: number;
  rewardAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  maxClaims?: number;
  status?: HostTaskStatus;
}

export interface ClaimHostTaskResult {
  rewardAmount: number;
  newCoins: number;
  claimedAt: string;
}

export const hostTasksApi = {
  getRoomTask(roomId: string) {
    return apiFetch<HostTaskEnvelope<ViewerHostTask | null>>(
      `/api/v1/rooms/${roomId}/host-task`,
    ).then((r) => r.data);
  },

  listRoomTasks(roomId: string) {
    return apiFetch<HostTaskEnvelope<HostTaskWithStats[]>>(
      `/api/v1/rooms/${roomId}/host-tasks`,
    ).then((r) => r.data);
  },

  createTask(roomId: string, input: CreateHostTaskInput) {
    return apiFetch<HostTaskEnvelope<HostTaskConfig>>(
      `/api/v1/rooms/${roomId}/host-tasks`,
      { method: "POST", body: JSON.stringify(input) },
    ).then((r) => r.data);
  },

  updateTask(taskId: string, input: UpdateHostTaskInput) {
    return apiFetch<HostTaskEnvelope<HostTaskConfig>>(
      `/api/v1/host-tasks/${taskId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ).then((r) => r.data);
  },

  setStatus(taskId: string, status: HostTaskStatus) {
    return apiFetch<HostTaskEnvelope<HostTaskConfig>>(
      `/api/v1/host-tasks/${taskId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ).then((r) => r.data);
  },

  deleteTask(taskId: string) {
    return apiFetch<HostTaskEnvelope<null>>(`/api/v1/host-tasks/${taskId}`, {
      method: "DELETE",
    });
  },

  claim(taskId: string) {
    return apiFetch<HostTaskEnvelope<ClaimHostTaskResult>>(
      `/api/v1/host-tasks/${taskId}/claim`,
      { method: "POST" },
    ).then((r) => r.data);
  },

  heartbeat(roomId: string, seconds: number) {
    return apiFetch<HostTaskEnvelope<null>>(
      `/api/v1/rooms/${roomId}/host-task/heartbeat`,
      { method: "POST", body: JSON.stringify({ seconds }) },
    );
  },

  listAll() {
    return apiFetch<HostTaskEnvelope<HostTaskWithStats[]>>(
      `/api/v1/admin/host-tasks`,
    ).then((r) => r.data);
  },
};
