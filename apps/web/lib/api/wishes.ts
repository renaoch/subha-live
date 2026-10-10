import { apiFetch } from "@/lib/api/client";

export interface RoomWish {
  giftId: string;
  code: string;
  name: string;
  icon: string;
  coinPrice: number;
  targetCount: number;
  currentCount: number;
}

export interface RoomWishes {
  wishes: RoomWish[];
  fulfilled: number;
  total: number;
}

type Env<T> = { success: boolean; data: T };

export const wishesApi = {
  list(roomId: string) {
    return apiFetch<Env<RoomWishes>>(`/api/v1/rooms/${roomId}/wishes`).then((r) => r.data);
  },
  replace(roomId: string, wishes: Array<{ giftId: string; targetCount: number }>) {
    return apiFetch<Env<RoomWishes>>(`/api/v1/rooms/${roomId}/wishes`, {
      method: "PUT",
      body: JSON.stringify({ wishes }),
    }).then((r) => r.data);
  },
};
