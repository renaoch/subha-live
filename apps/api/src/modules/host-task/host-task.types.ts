// Manually typed (not generated) since `host_tasks` / `host_task_progress`
// were added after the last `supabase gen types` run. Re-generate
// database.types.ts and swap these out for `Tables<"host_tasks">` /
// `Tables<"host_task_progress">` once that's done (see the same note in
// room-task.types.ts).

export type HostTaskAudience = "all" | "new_users" | "existing_users";
export type HostTaskStatus = "active" | "inactive" | "ended";
export type HostTaskProgressStatus = "in_progress" | "completed" | "claimed";

export interface HostTaskRow {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  description: string;
  audience: HostTaskAudience;
  new_user_window_days: number;
  target_hours: number | null;
  target_coins: number | null;
  reward_amount: number;
  starts_at: string | null;
  expires_at: string | null;
  max_claims: number | null;
  status: HostTaskStatus;
  created_at: string;
  updated_at: string;
}

export interface HostTaskProgressRow {
  id: string;
  task_id: string;
  user_id: string;
  room_id: string;
  hours_progress: number;
  coins_progress: number;
  status: HostTaskProgressStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HostTaskConfig {
  id: string;
  roomId: string;
  createdBy: string;
  title: string;
  description: string;
  audience: HostTaskAudience;
  newUserWindowDays: number;
  targetHours: number | null;
  targetCoins: number | null;
  rewardAmount: number;
  startsAt: string | null;
  expiresAt: string | null;
  maxClaims: number | null;
  status: HostTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HostTaskStats {
  eligibleUsers: number;
  completedUsers: number;
  claimedUsers: number;
}

export interface HostTaskWithStats extends HostTaskConfig {
  stats: HostTaskStats;
}

export type ViewerTaskState =
  | "expired"
  | "not_eligible"
  | "active"
  | "in_progress"
  | "completed"
  | "claimed";

export interface ViewerHostTask extends HostTaskConfig {
  state: ViewerTaskState;
  progress: {
    hours: number;
    coins: number;
    percent: number;
  };
  remainingMs: number | null;
}

export function toHostTaskConfig(row: HostTaskRow): HostTaskConfig {
  return {
    id: row.id,
    roomId: row.room_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    audience: row.audience,
    newUserWindowDays: row.new_user_window_days,
    targetHours: row.target_hours,
    targetCoins: row.target_coins,
    rewardAmount: row.reward_amount,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    maxClaims: row.max_claims,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
