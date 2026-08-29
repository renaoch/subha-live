import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { CreateHostTaskInput, UpdateHostTaskInput } from "./host-task.schema";
import {
  toHostTaskConfig,
  type HostTaskConfig,
  type HostTaskProgressRow,
  type HostTaskRow,
  type HostTaskWithStats,
  type ViewerHostTask,
  type ViewerTaskState,
} from "./host-task.types";

async function getRoomOrThrow(roomId: string) {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to look up room", {
      code: "ROOM_LOOKUP_FAILED",
      details: error.message,
    });
  }
  if (!room) {
    throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  }
  return room as { id: string; host_id: string };
}

/** Host of the room, or a platform admin — both may manage the room's tasks. */
async function assertCanManage(roomId: string, userId: string) {
  const room = await getRoomOrThrow(roomId);

  if (room.host_id === userId) return room;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to verify permission", {
      code: "ADMIN_CHECK_FAILED",
      details: error.message,
    });
  }

  if (!profile?.is_admin) {
    throw new AppError(403, "Only the room's host or an admin can manage its tasks", {
      code: "HOST_TASK_FORBIDDEN",
    });
  }

  return room;
}

function isExpired(task: Pick<HostTaskRow, "expires_at">): boolean {
  return !!task.expires_at && new Date(task.expires_at) <= new Date();
}

async function isEligible(task: HostTaskRow, userId: string): Promise<boolean> {
  if (task.audience === "all") return true;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.created_at) return task.audience === "existing_users";

  const ageMs = Date.now() - new Date(profile.created_at).getTime();
  const windowMs = task.new_user_window_days * 24 * 60 * 60 * 1000;
  const isNew = ageMs <= windowMs;

  return task.audience === "new_users" ? isNew : !isNew;
}

function computePercent(task: HostTaskRow, progress: { hours_progress: number; coins_progress: number }) {
  const parts: number[] = [];
  if (task.target_hours) parts.push(Math.min(100, (progress.hours_progress / task.target_hours) * 100));
  if (task.target_coins) parts.push(Math.min(100, (progress.coins_progress / task.target_coins) * 100));
  if (parts.length === 0) return 0;
  // A task can require *both* hours and coins — only "done" once every
  // configured target is met, so use the minimum of the two percentages.
  return Number(Math.min(...parts).toFixed(2));
}

function meetsTarget(task: HostTaskRow, progress: { hours_progress: number; coins_progress: number }) {
  if (task.target_hours != null && progress.hours_progress < task.target_hours) return false;
  if (task.target_coins != null && progress.coins_progress < task.target_coins) return false;
  return true;
}

async function getOrCreateProgress(
  taskId: string,
  userId: string,
  roomId: string,
): Promise<HostTaskProgressRow> {
  const { data: existing, error: fetchError } = await supabase
    .from("host_task_progress")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(500, "Failed to load task progress", {
      code: "HOST_TASK_PROGRESS_LOAD_FAILED",
      details: fetchError.message,
    });
  }

  if (existing) return existing as HostTaskProgressRow;

  const { data: created, error: createError } = await supabase
    .from("host_task_progress")
    .insert({ task_id: taskId, user_id: userId, room_id: roomId })
    .select("*")
    .single();

  if (createError) {
    // Concurrent first-progress-event race: someone else inserted it
    // first (unique task_id+user_id). Just re-read.
    const { data: reread } = await supabase
      .from("host_task_progress")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .single();
    if (reread) return reread as HostTaskProgressRow;

    throw new AppError(500, "Failed to initialize task progress", {
      code: "HOST_TASK_PROGRESS_CREATE_FAILED",
      details: createError.message,
    });
  }

  return created as HostTaskProgressRow;
}

async function assertIsPlatformAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to verify admin permission", {
      code: "ADMIN_CHECK_FAILED",
      details: error.message,
    });
  }
  if (!data?.is_admin) {
    throw new AppError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
  }
}

export const hostTaskService = {
  assertIsPlatformAdmin,

  async createTask(roomId: string, userId: string, input: CreateHostTaskInput): Promise<HostTaskConfig> {
    await assertCanManage(roomId, userId);

    const { data, error } = await supabase
      .from("host_tasks")
      .insert({
        room_id: roomId,
        created_by: userId,
        title: input.title,
        description: input.description ?? "",
        audience: input.audience,
        new_user_window_days: input.newUserWindowDays,
        target_hours: input.targetHours ?? null,
        target_coins: input.targetCoins ?? null,
        reward_amount: input.rewardAmount,
        starts_at: input.startsAt?.toISOString(),
        expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
        max_claims: input.maxClaims ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to create task", {
        code: "HOST_TASK_CREATE_FAILED",
        details: error.message,
      });
    }

    return toHostTaskConfig(data as HostTaskRow);
  },

  async updateTask(taskId: string, userId: string, input: UpdateHostTaskInput): Promise<HostTaskConfig> {
    const task = await this.getTaskOrThrow(taskId);
    await assertCanManage(task.room_id, userId);

    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.audience !== undefined) patch.audience = input.audience;
    if (input.newUserWindowDays !== undefined) patch.new_user_window_days = input.newUserWindowDays;
    if (input.targetHours !== undefined) patch.target_hours = input.targetHours;
    if (input.targetCoins !== undefined) patch.target_coins = input.targetCoins;
    if (input.rewardAmount !== undefined) patch.reward_amount = input.rewardAmount;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt?.toISOString();
    if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt ? input.expiresAt.toISOString() : null;
    if (input.maxClaims !== undefined) patch.max_claims = input.maxClaims;
    if (input.status !== undefined) patch.status = input.status;

    const { data, error } = await supabase
      .from("host_tasks")
      .update(patch as never)
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to update task", {
        code: "HOST_TASK_UPDATE_FAILED",
        details: error.message,
      });
    }

    return toHostTaskConfig(data as HostTaskRow);
  },

  async setStatus(taskId: string, userId: string, status: "active" | "inactive" | "ended"): Promise<HostTaskConfig> {
    return this.updateTask(taskId, userId, { status } as UpdateHostTaskInput);
  },

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    await assertCanManage(task.room_id, userId);

    const { error } = await supabase.from("host_tasks").delete().eq("id", taskId);

    if (error) {
      throw new AppError(500, "Failed to delete task", {
        code: "HOST_TASK_DELETE_FAILED",
        details: error.message,
      });
    }
  },

  async getTaskOrThrow(taskId: string): Promise<HostTaskRow> {
    const { data, error } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to load task", {
        code: "HOST_TASK_LOAD_FAILED",
        details: error.message,
      });
    }
    if (!data) throw new AppError(404, "Task not found", { code: "HOST_TASK_NOT_FOUND" });

    return data as HostTaskRow;
  },

  /** Host/admin management view: every task for the room, with rollup counts. */
  async listForRoom(roomId: string, userId: string): Promise<HostTaskWithStats[]> {
    await assertCanManage(roomId, userId);

    const { data: tasks, error } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(500, "Failed to list tasks", {
        code: "HOST_TASK_LIST_FAILED",
        details: error.message,
      });
    }

    const rows = (tasks ?? []) as HostTaskRow[];
    if (rows.length === 0) return [];

    const taskIds = rows.map((t) => t.id);
    const { data: progressRows, error: progressError } = await supabase
      .from("host_task_progress")
      .select("task_id, status")
      .in("task_id", taskIds);

    if (progressError) {
      throw new AppError(500, "Failed to load task stats", {
        code: "HOST_TASK_STATS_FAILED",
        details: progressError.message,
      });
    }

    const stats = new Map<string, { eligibleUsers: number; completedUsers: number; claimedUsers: number }>();
    for (const row of (progressRows ?? []) as Array<{ task_id: string; status: string }>) {
      const s = stats.get(row.task_id) ?? { eligibleUsers: 0, completedUsers: 0, claimedUsers: 0 };
      s.eligibleUsers += 1;
      if (row.status === "completed" || row.status === "claimed") s.completedUsers += 1;
      if (row.status === "claimed") s.claimedUsers += 1;
      stats.set(row.task_id, s);
    }

    return rows.map((row) => ({
      ...toHostTaskConfig(row),
      stats: stats.get(row.id) ?? { eligibleUsers: 0, completedUsers: 0, claimedUsers: 0 },
    }));
  },

  /**
   * Global admin view across every room — same shape as `listForRoom`
   * but without the host/admin room-membership check (caller must
   * already be verified as an admin).
   */
  async listAll(): Promise<HostTaskWithStats[]> {
    const { data: tasks, error } = await supabase
      .from("host_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(500, "Failed to list tasks", {
        code: "HOST_TASK_LIST_FAILED",
        details: error.message,
      });
    }

    const rows = (tasks ?? []) as HostTaskRow[];
    if (rows.length === 0) return [];

    const taskIds = rows.map((t) => t.id);
    const { data: progressRows } = await supabase
      .from("host_task_progress")
      .select("task_id, status")
      .in("task_id", taskIds);

    const stats = new Map<string, { eligibleUsers: number; completedUsers: number; claimedUsers: number }>();
    for (const row of (progressRows ?? []) as Array<{ task_id: string; status: string }>) {
      const s = stats.get(row.task_id) ?? { eligibleUsers: 0, completedUsers: 0, claimedUsers: 0 };
      s.eligibleUsers += 1;
      if (row.status === "completed" || row.status === "claimed") s.completedUsers += 1;
      if (row.status === "claimed") s.claimedUsers += 1;
      stats.set(row.task_id, s);
    }

    return rows.map((row) => ({
      ...toHostTaskConfig(row),
      stats: stats.get(row.id) ?? { eligibleUsers: 0, completedUsers: 0, claimedUsers: 0 },
    }));
  },

  /**
   * Viewer/host-facing single active task for a room. Public (no auth
   * required to see that a task exists), but progress/state is only
   * personalized when `userId` is provided.
   */
  async getActiveTaskForViewer(roomId: string, userId: string | null): Promise<ViewerHostTask | null> {
    const { data, error } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to load room task", {
        code: "HOST_TASK_LOAD_FAILED",
        details: error.message,
      });
    }
    if (!data) return null;

    const task = data as HostTaskRow;
    const config = toHostTaskConfig(task);
    const remainingMs = task.expires_at
      ? Math.max(0, new Date(task.expires_at).getTime() - Date.now())
      : null;

    if (isExpired(task)) {
      return { ...config, state: "expired", progress: { hours: 0, coins: 0, percent: 0 }, remainingMs: 0 };
    }

    if (!userId) {
      return { ...config, state: "active", progress: { hours: 0, coins: 0, percent: 0 }, remainingMs };
    }

    const eligible = await isEligible(task, userId);
    if (!eligible) {
      return { ...config, state: "not_eligible", progress: { hours: 0, coins: 0, percent: 0 }, remainingMs };
    }

    const { data: progressRow } = await supabase
      .from("host_task_progress")
      .select("*")
      .eq("task_id", task.id)
      .eq("user_id", userId)
      .maybeSingle();

    const progress = (progressRow as HostTaskProgressRow | null) ?? {
      hours_progress: 0,
      coins_progress: 0,
      status: "in_progress" as const,
    };

    const state: ViewerTaskState =
      progress.status === "claimed"
        ? "claimed"
        : progress.status === "completed"
          ? "completed"
          : progress.hours_progress > 0 || progress.coins_progress > 0
            ? "in_progress"
            : "active";

    return {
      ...config,
      state,
      progress: {
        hours: progress.hours_progress,
        coins: progress.coins_progress,
        percent: computePercent(task, progress),
      },
      remainingMs,
    };
  },

  /** Best-effort: bump a user's coin progress on every active, eligible
   * task in the room. Called from the gift/charisma flow — never let a
   * hiccup here fail the gift itself (caller should catch). */
  async recordCoinProgress(roomId: string, userId: string, coinsEarned: number): Promise<void> {
    if (coinsEarned <= 0) return;

    const { data: tasks, error } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .not("target_coins", "is", null);

    if (error) throw error;

    for (const row of (tasks ?? []) as HostTaskRow[]) {
      if (isExpired(row)) continue;
      if (!(await isEligible(row, userId))) continue;
      await this.bumpUserProgress(row, userId, { coins: coinsEarned });
    }
  },

  /** Same idea, for streaming/watch-time heartbeats. `role` distinguishes
   * host-streaming-hours from viewer-watch-hours — currently both count
   * toward `target_hours`, which matches the "watch/stream" wording in
   * the task copy; split this out if the two ever need separate targets. */
  async recordHeartbeat(roomId: string, userId: string, hoursDelta: number): Promise<void> {
    if (hoursDelta <= 0) return;

    const { data: tasks, error } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .not("target_hours", "is", null);

    if (error) throw error;

    for (const row of (tasks ?? []) as HostTaskRow[]) {
      if (isExpired(row)) continue;
      if (!(await isEligible(row, userId))) continue;
      await this.bumpUserProgress(row, userId, { hours: hoursDelta });
    }
  },

  async bumpUserProgress(
    task: HostTaskRow,
    userId: string,
    delta: { hours?: number; coins?: number },
  ): Promise<void> {
    const progress = await getOrCreateProgress(task.id, userId, task.room_id);
    if (progress.status === "completed" || progress.status === "claimed") return;

    const nextHours = progress.hours_progress + (delta.hours ?? 0);
    const nextCoins = progress.coins_progress + (delta.coins ?? 0);
    const done = meetsTarget(task, { hours_progress: nextHours, coins_progress: nextCoins });

    const { error } = await supabase
      .from("host_task_progress")
      .update({
        hours_progress: nextHours,
        coins_progress: nextCoins,
        status: done ? "completed" : "in_progress",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", progress.id);

    if (error) {
      throw new AppError(500, "Failed to update task progress", {
        code: "HOST_TASK_PROGRESS_UPDATE_FAILED",
        details: error.message,
      });
    }
  },

  /**
   * Atomic, idempotent claim. All eligibility/expiry/limit/completion
   * checks are re-verified inside the `claim_host_task_reward` Postgres
   * function under row locks — the frontend's view of "COMPLETED" is
   * only ever a hint, never trusted here.
   */
  async claim(taskId: string, userId: string): Promise<{ rewardAmount: number; newCoins: number }> {
    const { data, error } = await supabase.rpc("claim_host_task_reward", {
      p_task_id: taskId,
      p_user_id: userId,
    });

    if (error) {
      const code = error.message?.includes("TASK_NOT_FOUND")
        ? "HOST_TASK_NOT_FOUND"
        : error.message?.includes("TASK_NOT_ACTIVE")
          ? "HOST_TASK_NOT_ACTIVE"
          : error.message?.includes("TASK_EXPIRED")
            ? "HOST_TASK_EXPIRED"
            : error.message?.includes("TASK_CLAIM_LIMIT_REACHED")
              ? "HOST_TASK_CLAIM_LIMIT_REACHED"
              : error.message?.includes("TASK_NOT_COMPLETED")
                ? "HOST_TASK_NOT_COMPLETED"
                : "HOST_TASK_CLAIM_FAILED";

      const status = code === "HOST_TASK_CLAIM_FAILED" ? 500 : 400;

      throw new AppError(status, "Unable to claim reward", { code, details: error.message });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new AppError(500, "Claim did not return a result", { code: "HOST_TASK_CLAIM_FAILED" });
    }

    return { rewardAmount: row.reward_amount, newCoins: row.new_coins };
  },
};