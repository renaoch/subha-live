// Manually typed (not generated) since `room_tasks` was added after the
// last `supabase gen types` run. Re-generate database.types.ts and swap
// this out for `Tables<"room_tasks">` once that's done.

export interface RoomTaskRow {
  id: string;
  room_id: string;
  host_id: string;
  title: string;
  target_value: number;
  current_value: number;
  reward_coins: number;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RoomTask {
  id: string;
  roomId: string;
  hostId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  progress: number; // 0-100, clamped
  rewardCoins: number;
  status: RoomTaskRow["status"];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Per-viewer: whether the CURRENT user already claimed this task's reward. Omitted for anonymous/public reads. */
  isClaimed?: boolean;
  claimedAt?: string | null;
}

export function toRoomTask(
  row: RoomTaskRow,
  claim?: { claimed_at: string } | null,
): RoomTask {
  const progress =
    row.target_value > 0
      ? Math.min(100, Math.max(0, (row.current_value / row.target_value) * 100))
      : 0;

  return {
    id: row.id,
    roomId: row.room_id,
    hostId: row.host_id,
    title: row.title,
    targetValue: row.target_value,
    currentValue: row.current_value,
    progress: Number(progress.toFixed(2)),
    rewardCoins: row.reward_coins ?? 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    ...(claim !== undefined
      ? { isClaimed: !!claim, claimedAt: claim?.claimed_at ?? null }
      : {}),
  };
}

export interface ClaimRoomTaskResultRow {
  claim_id: string;
  reward_coins: number;
  new_coins: number;
  claimed_at: string;
}

export interface ClaimRoomTaskResult {
  taskId: string;
  rewardCoins: number;
  newCoins: number;
  claimedAt: string;
}
