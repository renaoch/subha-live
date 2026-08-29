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

export const roomTasksApi = {
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
