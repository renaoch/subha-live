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
  status: RoomTaskRow["status"];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function toRoomTask(row: RoomTaskRow): RoomTask {
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
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
