import { apiFetch } from "@/lib/api/client";

export interface LiveBoxStatus {
  available: boolean;
  rewardCoins: number;
  intervalSeconds: number;
  dailyLimit: number;
  claimedToday: number;
  remainingToday: number;
  nextReadyAt: string | null;
  canClaim: boolean;
  serverNow: string;
}

export interface LiveBoxClaimResult {
  rewardCoins: number;
  newCoins: number;
  claimedToday: number;
  dailyLimit: number;
  remainingToday: number;
  nextReadyAt: string;
}

export interface LiveBoxSettings {
  isEnabled: boolean;
  intervalSeconds: number;
  rewardCoins: number;
  dailyLimit: number;
}

type Env<T> = { success: boolean; data: T };

export const liveBoxApi = {
  status(roomId: string) {
    return apiFetch<Env<LiveBoxStatus>>(`/api/v1/rooms/${roomId}/live-box`).then((r) => r.data);
  },
  claim(roomId: string) {
    return apiFetch<Env<LiveBoxClaimResult>>(`/api/v1/rooms/${roomId}/live-box/claim`, { method: "POST" }).then((r) => r.data);
  },
  adminGet() {
    return apiFetch<Env<LiveBoxSettings>>(`/api/v1/admin/live-box`).then((r) => r.data);
  },
  adminSave(input: Partial<LiveBoxSettings>) {
    return apiFetch<Env<LiveBoxSettings>>(`/api/v1/admin/live-box`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.data);
  },
};
