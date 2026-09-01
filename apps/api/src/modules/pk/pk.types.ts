// PK battle types (Core API side). The realtime service has its own copy of
// the event/state shapes (no shared package between the two services).

export type PkStatus =
  | "IDLE"
  | "INVITED"
  | "ACCEPTED"
  | "STARTING"
  | "ACTIVE"
  | "FINALIZING"
  | "FINISHED"
  | "CANCELLED";

export type PkSide = "A" | "B";
export type PkWinner = "A" | "B" | "DRAW";

export interface PkBattleRow {
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

export interface PkParticipantRow {
  id: string;
  battle_id: string;
  user_id: string;
  side: PkSide;
  joined_at: string;
  left_at: string | null;
}

/** Redis hot-state (hash `pk:{battleId}:state`). */
export interface PkRedisState {
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
}

export const PK_DEFAULT_DURATION_MS = 180_000;
export const PK_FINISHED_RETENTION_SECONDS = 30 * 60;
