import { apiFetch } from "@/lib/api/client";

interface RoomTaskEnvelope<T> {
  success: boolean;
  data: T;
}

export interface RoomTask {
  id: string;
  roomId: string;
  hostId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  progress: number; // 0-100
  rewardCoins: number;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Only present when the caller was authenticated. */
  isClaimed?: boolean;
  claimedAt?: string | null;
}

export interface SetRoomTaskInput {
  title: string;
  targetValue: number;
  rewardCoins?: number;
}

export interface ClaimRoomTaskResult {
  taskId: string;
  rewardCoins: number;
  newCoins: number;
  claimedAt: string;
}

export interface AdminStarTarget extends RoomTask {
  roomTitle: string | null;
  hostName: string | null;
}

/** An admin-defined Star Target: all lives, or one host's rooms. */
export interface StarTargetTemplate {
  id: string;
  title: string;
  targetValue: number;
  rewardCoins: number;
  hostId: string | null;
  hostName: string | null;
  scope: "all" | "host";
  isActive: boolean;
  createdAt: string;
  /** Rooms currently running this target / rooms that reached it. */
  runningRooms: number;
  completedRooms: number;
}

export interface CreateStarTargetInput {
  title: string;
  targetValue: number;
  rewardCoins?: number;
  /** Omit for every live; a profile id for one host only. */
  hostId?: string | null;
}

export interface HostSearchResult {
  id: string;
  name: string;
  handle: string;
  publicId: string | null;
  avatar: string | null;
}

export const roomTasksApi = {
  adminTemplates() {
    return apiFetch<RoomTaskEnvelope<StarTargetTemplate[]>>(`/api/v1/admin/star-targets/templates`).then((r) => r.data);
  },
  adminCreateTemplate(input: CreateStarTargetInput) {
    return apiFetch<RoomTaskEnvelope<{ id: string }>>(`/api/v1/admin/star-targets/templates`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },
  adminEndTemplate(id: string) {
    return apiFetch<RoomTaskEnvelope<null>>(`/api/v1/admin/star-targets/templates/${id}`, { method: "DELETE" });
  },
  adminSearchHosts(q: string) {
    return apiFetch<RoomTaskEnvelope<HostSearchResult[]>>(
      `/api/v1/admin/star-targets/hosts?q=${encodeURIComponent(q)}`,
    ).then((r) => r.data);
  },
  /** Admin console: newest Star Targets across all rooms. */
  adminList() {
    return apiFetch<RoomTaskEnvelope<AdminStarTarget[]>>(
      `/api/v1/admin/star-targets`,
    ).then((r) => r.data);
  },

  getTask(roomId: string) {
    return apiFetch<RoomTaskEnvelope<RoomTask | null>>(
      `/api/v1/rooms/${roomId}/task`,
    ).then((r) => r.data);
  },

  setTask(roomId: string, input: SetRoomTaskInput) {
    return apiFetch<RoomTaskEnvelope<RoomTask>>(
      `/api/v1/rooms/${roomId}/task`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ).then((r) => r.data);
  },

  cancelTask(roomId: string) {
    return apiFetch<RoomTaskEnvelope<null>>(`/api/v1/rooms/${roomId}/task`, {
      method: "DELETE",
    });
  },

  claim(roomId: string) {
    return apiFetch<RoomTaskEnvelope<ClaimRoomTaskResult>>(
      `/api/v1/rooms/${roomId}/task/claim`,
      { method: "POST" },
    ).then((r) => r.data);
  },
};