import { apiFetch } from "@/lib/api/client";

interface PkEnvelope<T> {
  success: boolean;
  data: T;
}

export type PkStatus =
  | "IDLE"
  | "INVITED"
  | "ACCEPTED"
  | "STARTING"
  | "ACTIVE"
  | "FINALIZING"
  | "FINISHED"
  | "CANCELLED";

export type PkWinner = "A" | "B" | "DRAW";

export interface PkBattle {
  id: string;
  room_a_id: string;
  room_b_id: string;
  host_a_id: string;
  host_b_id: string;
  status: PkStatus;
  score_a: number;
  score_b: number;
  winner_host_id: string | null;
  winner_side: PkWinner | null;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  invited_by: string;
  created_at: string;
  updated_at: string;
}

/** Hot-state view returned by GET /pk/:id and /pk/for-room/:roomId. */
export interface PkState {
  battleId: string;
  status: PkStatus;
  hostA: string;
  hostB: string;
  roomA: string;
  roomB: string;
  scoreA: number;
  scoreB: number;
  startedAt: number | null;
  endsAt: number | null;
  version: number;
  winner?: PkWinner | null;
}

export interface PkHistoryEntry {
  battleId: string;
  opponentId: string;
  opponentName: string;
  opponentAvatar: string | null;
  result: "WIN" | "LOSS" | "DRAW";
  myScore: number;
  opponentScore: number;
  durationMs: number | null;
  endedAt: string | null;
}

export interface PkStats {
  totalBattles: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  highestScore: number;
  totalCoins: number;
}

export const pkApi = {
  invite(roomId: string, opponentHostId: string) {
    return apiFetch<PkEnvelope<PkBattle>>("/api/v1/pk/invite", {
      method: "POST",
      body: JSON.stringify({ roomId, opponentHostId }),
    }).then((r) => r.data);
  },

  accept(battleId: string) {
    return apiFetch<PkEnvelope<PkBattle>>(`/api/v1/pk/${battleId}/accept`, {
      method: "POST",
    }).then((r) => r.data);
  },

  decline(battleId: string) {
    return apiFetch<PkEnvelope<PkBattle>>(`/api/v1/pk/${battleId}/decline`, {
      method: "POST",
    }).then((r) => r.data);
  },

  start(battleId: string) {
    return apiFetch<PkEnvelope<PkBattle>>(`/api/v1/pk/${battleId}/start`, {
      method: "POST",
    }).then((r) => r.data);
  },

  cancel(battleId: string) {
    return apiFetch<PkEnvelope<PkBattle>>(`/api/v1/pk/${battleId}/cancel`, {
      method: "POST",
    }).then((r) => r.data);
  },

  get(battleId: string) {
    return apiFetch<PkEnvelope<PkState | null>>(`/api/v1/pk/${battleId}`).then(
      (r) => r.data,
    );
  },

  getForRoom(roomId: string) {
    return apiFetch<PkEnvelope<PkState | null>>(
      `/api/v1/pk/for-room/${roomId}`,
    ).then((r) => r.data);
  },

  /** Currently active/pending battles, for Party's PK discovery surface. */
  listActive() {
    return apiFetch<PkEnvelope<PkBattle[]>>("/api/v1/pk/active").then(
      (r) => r.data,
    );
  },

  history(hostId: string, limit = 20) {
    return apiFetch<PkEnvelope<PkHistoryEntry[]>>(
      `/api/v1/pk/history/${hostId}?limit=${limit}`,
    ).then((r) => r.data);
  },

  last(hostId: string) {
    return apiFetch<PkEnvelope<PkHistoryEntry | null>>(
      `/api/v1/pk/last/${hostId}`,
    ).then((r) => r.data);
  },

  stats(hostId: string) {
    return apiFetch<PkEnvelope<PkStats>>(`/api/v1/pk/stats/${hostId}`).then(
      (r) => r.data,
    );
  },
};
