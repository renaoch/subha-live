import { apiFetch } from "@/lib/api/client";

export interface Challenge {
  id: string;
  title: string;
  subtitle: string;
  country: string | null;
  rewardText: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface ChallengeStanding {
  rank: number;
  hostId: string;
  name: string;
  avatar: string | null;
  countryFlag: string | null;
  totalDiamonds: number;
}

export interface RoomChallenge {
  challenge: Challenge;
  serverNow: string;
  top: ChallengeStanding[];
  hostStanding: ChallengeStanding | null;
}

export interface CreateChallengeInput {
  title: string;
  subtitle?: string;
  country?: string | null;
  rewardText?: string | null;
  startsAt: string;
  endsAt: string;
}

type Env<T> = { success: boolean; data: T };

export const challengesApi = {
  forRoom(roomId: string) {
    return apiFetch<Env<RoomChallenge | null>>(`/api/v1/rooms/${roomId}/challenge`).then((r) => r.data);
  },
  leaderboard(challengeId: string, limit = 20, hostId?: string) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (hostId) q.set("hostId", hostId);
    return apiFetch<Env<{ challenge: Challenge; standings: ChallengeStanding[]; serverNow: string }>>(
      `/api/v1/challenges/${challengeId}/leaderboard?${q}`,
    ).then((r) => r.data);
  },
  adminList() {
    return apiFetch<Env<Challenge[]>>(`/api/v1/admin/challenges`).then((r) => r.data);
  },
  adminCreate(input: CreateChallengeInput) {
    return apiFetch<Env<Challenge>>(`/api/v1/admin/challenges`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },
  adminUpdate(id: string, patch: Partial<Pick<Challenge, "isActive" | "endsAt" | "title" | "subtitle" | "rewardText">>) {
    return apiFetch<Env<Challenge>>(`/api/v1/admin/challenges/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.data);
  },
};
