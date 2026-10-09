import { apiFetch } from "@/lib/api/client";

export interface RoomOverview {
  roomId: string;
  host: { id: string; publicId: string | null; isVerified: boolean };
  topContributors: Array<{
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    totalCoins: number;
  }>;
  hostRank: { rank: number; totalDiamonds: number; period: "daily" } | null;
}

export const roomOverviewApi = {
  get(roomId: string) {
    return apiFetch<{ success: boolean; data: RoomOverview }>(
      `/api/v1/rooms/${roomId}/overview`,
    ).then((r) => r.data);
  },
};
