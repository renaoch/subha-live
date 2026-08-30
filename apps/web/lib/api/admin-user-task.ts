import { apiFetch } from "@/lib/api/client";

interface AdminTaskEnvelope<T> {
  success: boolean;
  data: T;
}

export type AdminTaskDurationType = "daily" | "weekly" | "one_time";
export type AdminTaskGender = "all" | "male" | "female";
export type AdminTaskStatus = "active" | "inactive";

export interface AdminTaskReward {
  coins: number;
  diamonds: number;
  exp: number;
}

export interface AdminTaskStats {
  assignedUsers: number;
  completedUsers: number;
  claimedUsers: number;
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
  reward: AdminTaskReward;
  createdAt: string;
  updatedAt: string;
  stats: AdminTaskStats;
}

export interface CreateAdminTaskInput {
  title: string;
  description?: string | null;
  durationType?: AdminTaskDurationType;
  iconUrl?: string | null;
  targetCount?: number;
  rewardCoins?: number;
  rewardDiamonds?: number;
  rewardExp?: number;
  targetGender?: AdminTaskGender;
  status?: AdminTaskStatus;
  expiryDate?: string | null;
}

export type UpdateAdminTaskInput = Partial<CreateAdminTaskInput>;

export const adminUserTasksApi = {
  list() {
    return apiFetch<AdminTaskEnvelope<AdminTaskItem[]>>(
      "/api/v1/admin/tasks",
    ).then((r) => r.data);
  },

  create(input: CreateAdminTaskInput) {
    return apiFetch<AdminTaskEnvelope<AdminTaskItem>>("/api/v1/admin/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  update(id: string, input: UpdateAdminTaskInput) {
    return apiFetch<AdminTaskEnvelope<AdminTaskItem>>(
      `/api/v1/admin/tasks/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ).then((r) => r.data);
  },

  setStatus(id: string, status: AdminTaskStatus) {
    return apiFetch<AdminTaskEnvelope<AdminTaskItem>>(
      `/api/v1/admin/tasks/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ).then((r) => r.data);
  },

  remove(id: string) {
    return apiFetch<AdminTaskEnvelope<null>>(`/api/v1/admin/tasks/${id}`, {
      method: "DELETE",
    });
  },
};
