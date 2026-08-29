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
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SetRoomTaskInput {
  title: string;
  targetValue: number;
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
};
