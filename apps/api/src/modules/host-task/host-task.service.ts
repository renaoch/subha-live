import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { CreateHostTaskInput, UpdateHostTaskInput } from "./host-task.schema";
import {
  toHostTaskConfig,
  type ClaimHostTaskResult,
  type HostTaskConfig,
  type HostTaskProgressRow,
  type HostTaskRow,
  type HostTaskWithStats,
  type ViewerHostTask,
} from "./host-task.types";
import {
  computeTaskPercent,
  deriveViewerState,
  isTaskExpired,
  isTaskNotStarted,
  matchesTargetGender,
  normalizeGender,
  creditableSeconds,
  meetsTaskTarget,
  remainingMs,
  resolveEligibility,
} from "./host-task.logic";
import { publishHostTaskEvent } from "./host-task.realtime";

// `host_tasks` / `host_task_progress` aren't in the generated Database
// type yet (see the note in host-task.types.ts), so the typed `supabase`
// client's `.from()` overloads reject their table names outright. Route
// just those calls through an untyped view of the same client — every
// row is still cast back to its real shape (HostTaskRow /
// HostTaskProgressRow) right where it's read.
const db = supabase as unknown as {
  from: (table: "host_tasks" | "host_task_progress") => any;
  rpc: (fn: "claim_host_task_reward", args: Record<string, unknown>) => any;
};

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

/**
 * Authoring (create / edit / delete / enable) is ADMIN-ONLY. Tasks carry coin
 * rewards, so letting a host author one for their own room would let them mint
 * coins for themselves. Hosts only ever *see* and *claim* tasks.
 */
async function assertCanManage(_roomId: string | null, userId: string) {
  await assertIsPlatformAdmin(userId);
}

/** The room's host (or an admin) may read the room's Host Task Center. */
async function assertHostOrAdmin(roomId: string, userId: string) {
  const room = await getRoomOrThrow(roomId);
  if (room.host_id === userId) return room;
  await assertIsPlatformAdmin(userId);
  return room;
}

async function getProfileFacts(
  userId: string,
): Promise<{ createdAt: string | null; gender: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at, gender")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return { createdAt: null, gender: null };
  return { createdAt: data.created_at ?? null, gender: data.gender ?? null };
}

async function isEligible(task: HostTaskRow, userId: string): Promise<boolean> {
  if (task.audience === "all" && (task.target_gender ?? "all") === "all") return true;
  const { createdAt, gender } = await getProfileFacts(userId);
  if (!matchesTargetGender(task.target_gender, gender)) return false;
  return resolveEligibility(task.audience, createdAt, task.new_user_window_days);
}

/** Tasks that apply to a room: the room's own tasks plus every global one. */
function roomScope(roomId: string): string {
  return `room_id.eq.${roomId},room_id.is.null`;
}

// Last accepted heartbeat per room+user. In-memory is enough to stop a single
// client crediting hours faster than wall-clock; move to Redis if the API is
// ever run as several instances behind a non-sticky balancer.
const lastHeartbeatAt = new Map<string, number>();

async function getOrCreateProgress(
  taskId: string,
  userId: string,
  roomId: string,
): Promise<HostTaskProgressRow> {
  const { data: existing, error: fetchError } = await db
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

  const { data: created, error: createError } = await db
    .from("host_task_progress")
    .insert({ task_id: taskId, user_id: userId, room_id: roomId })
    .select("*")
    .single();

  if (createError) {
    // Concurrent first-progress-event race: someone else inserted it
    // first (unique task_id+user_id). Just re-read.
    const { data: reread } = await db
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

  async createTask(roomId: string | null, userId: string, input: CreateHostTaskInput): Promise<HostTaskConfig> {
    await assertCanManage(roomId, userId);

    const { data, error } = await db
      .from("host_tasks")
      .insert({
        room_id: roomId,
        created_by: userId,
        title: input.title,
        description: input.description ?? "",
        category: input.category,
        target_gender: input.targetGender,
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

    const task = toHostTaskConfig(data as HostTaskRow);
    if (roomId) await publishHostTaskEvent(roomId, { type: "task.created", taskId: task.id });
    return task;
  },

  async updateTask(taskId: string, userId: string, input: UpdateHostTaskInput): Promise<HostTaskConfig> {
    const task = await this.getTaskOrThrow(taskId);
    await assertCanManage(task.room_id, userId);

    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.category !== undefined) patch.category = input.category;
    if (input.targetGender !== undefined) patch.target_gender = input.targetGender;
    if (input.audience !== undefined) patch.audience = input.audience;
    if (input.newUserWindowDays !== undefined) patch.new_user_window_days = input.newUserWindowDays;
    if (input.targetHours !== undefined) patch.target_hours = input.targetHours;
    if (input.targetCoins !== undefined) patch.target_coins = input.targetCoins;
    if (input.rewardAmount !== undefined) patch.reward_amount = input.rewardAmount;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt?.toISOString();
    if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt ? input.expiresAt.toISOString() : null;
    if (input.maxClaims !== undefined) patch.max_claims = input.maxClaims;
    if (input.status !== undefined) patch.status = input.status;

    const { data, error } = await db
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

    const updated = toHostTaskConfig(data as HostTaskRow);

    const eventType: "task.enabled" | "task.disabled" | "task.updated" =
      input.status === "active"
        ? "task.enabled"
        : input.status === "inactive" || input.status === "ended"
          ? "task.disabled"
          : "task.updated";

    if (updated.roomId) await publishHostTaskEvent(updated.roomId, { type: eventType, taskId: updated.id });
    return updated;
  },

  async setStatus(taskId: string, userId: string, status: "active" | "inactive" | "ended"): Promise<HostTaskConfig> {
    // updateTask publishes the correct task.enabled / task.disabled event.
    return this.updateTask(taskId, userId, { status } as UpdateHostTaskInput);
  },

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    await assertCanManage(task.room_id, userId);

    const { error } = await db.from("host_tasks").delete().eq("id", taskId);

    if (error) {
      throw new AppError(500, "Failed to delete task", {
        code: "HOST_TASK_DELETE_FAILED",
        details: error.message,
      });
    }

    if (task.room_id) await publishHostTaskEvent(task.room_id, { type: "task.deleted", taskId });
  },

  async getTaskOrThrow(taskId: string): Promise<HostTaskRow> {
    const { data, error } = await db
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

  /** Admin: create a task that is not tied to one room (applies to every host). */
  async createGlobalTask(userId: string, input: CreateHostTaskInput): Promise<HostTaskConfig> {
    return this.createTask(null, userId, input);
  },

  /** Host/admin management view: every task for the room, with rollup counts. */
  async listForRoom(roomId: string, userId: string): Promise<HostTaskWithStats[]> {
    await assertHostOrAdmin(roomId, userId);

    const { data: tasks, error } = await db
      .from("host_tasks")
      .select("*")
      .or(roomScope(roomId))
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
    const { data: progressRows, error: progressError } = await db
      .from("host_task_progress")
      .select("task_id, status")
      .in("task_id", taskIds);

    if (progressError) {
      throw new AppError(500, "Failed to load task stats", {
        code: "HOST_TASK_STATS_FAILED",
        details: progressError.message,
      });
    }

    return rows.map((row) => ({
      ...toHostTaskConfig(row),
      stats: rollupStats(row.id, progressRows as Array<{ task_id: string; status: string }> | null),
    }));
  },

  /**
   * Global admin view across every room — same shape as `listForRoom`
   * but without the host/admin room-membership check (caller must
   * already be verified as an admin).
   */
  async listAll(): Promise<HostTaskWithStats[]> {
    const { data: tasks, error } = await db
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
    const { data: progressRows } = await db
      .from("host_task_progress")
      .select("task_id, status")
      .in("task_id", taskIds);

    return rows.map((row) => ({
      ...toHostTaskConfig(row),
      stats: rollupStats(row.id, progressRows as Array<{ task_id: string; status: string }> | null),
    }));
  },

  /**
   * Viewer/host-facing single active task for a room. Public (no auth
   * required to see that a task exists), but progress/state is only
   * personalized when `userId` is provided.
   */
  async getActiveTaskForViewer(roomId: string, userId: string | null): Promise<ViewerHostTask | null> {
    // Viewers (and the host's room banner) see the newest ROOM-specific task.
    // Global tasks live in the host's Task Center modal instead.
    const { data, error } = await db
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

    const view = await this.buildViewerTask(data as HostTaskRow, userId, roomId);
    if (view.state === "expired") {
      await publishHostTaskEvent(roomId, { type: "task.expired", taskId: view.id });
    }
    return view;
  },

  /** Personalised view of one task for one user (progress, state, time left). */
  async buildViewerTask(
    task: HostTaskRow,
    userId: string | null,
    _roomId: string,
    profile?: { createdAt: string | null; gender: string | null },
  ): Promise<ViewerHostTask> {
    const config = toHostTaskConfig(task);
    const remaining = remainingMs(task.expires_at);
    const empty = { hours: 0, coins: 0, percent: 0 };

    if (isTaskExpired(task.expires_at)) {
      return { ...config, state: "expired", progress: empty, remainingMs: 0, claimedAt: null };
    }
    if (isTaskNotStarted(task.starts_at) || !userId) {
      return { ...config, state: "active", progress: empty, remainingMs: remaining, claimedAt: null };
    }

    const facts = profile ?? (await getProfileFacts(userId));
    const eligible =
      matchesTargetGender(task.target_gender, facts.gender) &&
      resolveEligibility(task.audience, facts.createdAt, task.new_user_window_days);
    if (!eligible) {
      return { ...config, state: "not_eligible", progress: empty, remainingMs: remaining, claimedAt: null };
    }

    const { data: progressRow } = await db
      .from("host_task_progress")
      .select("*")
      .eq("task_id", task.id)
      .eq("user_id", userId)
      .maybeSingle();

    const progress = (progressRow as HostTaskProgressRow | null) ?? {
      hours_progress: 0,
      coins_progress: 0,
      status: "in_progress" as const,
      claimed_at: null,
    };

    return {
      ...config,
      state: deriveViewerState(progress.status, progress.hours_progress ?? 0, progress.coins_progress ?? 0),
      progress: {
        hours: progress.hours_progress ?? 0,
        coins: progress.coins_progress ?? 0,
        percent: computeTaskPercent(
          task.target_hours,
          task.target_coins,
          progress.hours_progress ?? 0,
          progress.coins_progress ?? 0,
        ),
      },
      remainingMs: remaining,
      claimedAt: progress.claimed_at ?? null,
    };
  },

  /**
   * The host's in-room Task Center: every active task for this room (room
   * specific + global) that matches the caller's gender, with their own
   * progress. Gender filtering happens HERE, server-side — a male host never
   * receives female-only tasks in the payload at all.
   */
  async getHostCenter(
    roomId: string,
    userId: string,
  ): Promise<{ gender: "male" | "female" | null; tasks: ViewerHostTask[] }> {
    await assertHostOrAdmin(roomId, userId);

    const { data, error } = await db
      .from("host_tasks")
      .select("*")
      .or(roomScope(roomId))
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError(500, "Failed to load host tasks", {
        code: "HOST_TASK_LOAD_FAILED",
        details: error.message,
      });
    }

    const profile = await getProfileFacts(userId);
    const rows = ((data ?? []) as HostTaskRow[]).filter(
      (t) => matchesTargetGender(t.target_gender, profile.gender) && !isTaskExpired(t.expires_at),
    );

    const tasks = await Promise.all(rows.map((t) => this.buildViewerTask(t, userId, roomId, profile)));
    return { gender: normalizeGender(profile.gender), tasks };
  },

  /** Best-effort: bump a user's coin progress on every active, eligible
   * task in the room. Called from the gift/charisma flow — never let a
   * hiccup here fail the gift itself (caller should catch). */
  async recordCoinProgress(roomId: string, userId: string, coinsEarned: number): Promise<void> {
    if (coinsEarned <= 0) return;

    const { data: tasks, error } = await db
      .from("host_tasks")
      .select("*")
      .or(roomScope(roomId))
      .eq("status", "active")
      .not("target_coins", "is", null);

    if (error) throw error;

    for (const row of (tasks ?? []) as HostTaskRow[]) {
      if (isTaskExpired(row.expires_at)) continue;
      if (!(await isEligible(row, userId))) continue;
      await this.bumpUserProgress(row, userId, roomId, { coins: coinsEarned });
    }
  },

  /**
   * Entry point for the HTTP heartbeat. Only the room's host earns streaming
   * hours, only while the room is live, and each beat is clamped to real
   * elapsed time (see creditableSeconds) — the client's `seconds` is a hint,
   * never trusted as-is.
   */
  async acceptHeartbeat(roomId: string, userId: string, claimedSeconds: number): Promise<number> {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("id, host_id, status")
      .eq("id", roomId)
      .maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to look up room", { code: "ROOM_LOOKUP_FAILED", details: error.message });
    }
    if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
    if (room.host_id !== userId || room.status !== "live") return 0;

    const key = `${roomId}:${userId}`;
    const now = Date.now();
    const credited = creditableSeconds(claimedSeconds, lastHeartbeatAt.get(key) ?? null, now);
    lastHeartbeatAt.set(key, now);
    if (lastHeartbeatAt.size > 5000) {
      for (const [k, t] of lastHeartbeatAt) if (now - t > 10 * 60_000) lastHeartbeatAt.delete(k);
    }
    if (credited > 0) await this.recordHeartbeat(roomId, userId, credited / 3600);
    return credited;
  },

  /** Same idea, for streaming/watch-time heartbeats. `role` distinguishes
   * host-streaming-hours from viewer-watch-hours — currently both count
   * toward `target_hours`, which matches the "watch/stream" wording in
   * the task copy; split this out if the two ever need separate targets. */
  async recordHeartbeat(roomId: string, userId: string, hoursDelta: number): Promise<void> {
    if (hoursDelta <= 0) return;

    const { data: tasks, error } = await db
      .from("host_tasks")
      .select("*")
      .or(roomScope(roomId))
      .eq("status", "active")
      .not("target_hours", "is", null);

    if (error) throw error;

    for (const row of (tasks ?? []) as HostTaskRow[]) {
      if (isTaskExpired(row.expires_at)) continue;
      if (!(await isEligible(row, userId))) continue;
      await this.bumpUserProgress(row, userId, roomId, { hours: hoursDelta });
    }
  },

  async bumpUserProgress(
    task: HostTaskRow,
    userId: string,
    roomId: string,
    delta: { hours?: number; coins?: number },
  ): Promise<void> {
    const progress = await getOrCreateProgress(task.id, userId, roomId);
    if (progress.status === "completed" || progress.status === "claimed") return;

    const nextHours = (progress.hours_progress ?? 0) + (delta.hours ?? 0);
    const nextCoins = (progress.coins_progress ?? 0) + (delta.coins ?? 0);
    const done = meetsTaskTarget(task.target_hours, task.target_coins, nextHours, nextCoins);

    const { error } = await db
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

    const percent = computeTaskPercent(task.target_hours, task.target_coins, nextHours, nextCoins);
    await publishHostTaskEvent(roomId, {
      type: done ? "task.completed" : "task.progress.updated",
      taskId: task.id,
      userId,
      data: { percent, hours: nextHours, coins: nextCoins },
    });
  },

  /**
   * Atomic, idempotent claim. All eligibility/expiry/limit/completion
   * checks are re-verified inside the `claim_host_task_reward` Postgres
   * function under row locks — the frontend's view of "COMPLETED" is
   * only ever a hint, never trusted here.
   */
  async claim(taskId: string, userId: string): Promise<ClaimHostTaskResult> {
    const task = await this.getTaskOrThrow(taskId);

    const { data, error } = await db.rpc("claim_host_task_reward", {
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
            : error.message?.includes("TASK_NOT_STARTED")
              ? "HOST_TASK_NOT_STARTED"
              : error.message?.includes("TASK_CLAIM_LIMIT_REACHED")
                ? "HOST_TASK_CLAIM_LIMIT_REACHED"
                : error.message?.includes("TASK_NOT_ELIGIBLE")
                  ? "HOST_TASK_NOT_ELIGIBLE"
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

    if (task.room_id) await publishHostTaskEvent(task.room_id, {
      type: "task.claimed",
      taskId,
      userId,
      data: { rewardAmount: row.reward_amount },
    });

    return {
      rewardAmount: row.reward_amount,
      newCoins: row.new_coins,
      claimedAt: row.claimed_at,
    };
  },
};

function rollupStats(
  taskId: string,
  progressRows: Array<{ task_id: string; status: string }> | null,
): { eligibleUsers: number; completedUsers: number; claimedUsers: number } {
  let eligibleUsers = 0;
  let completedUsers = 0;
  let claimedUsers = 0;

  for (const row of progressRows ?? []) {
    if (row.task_id !== taskId) continue;
    eligibleUsers += 1;
    if (row.status === "completed" || row.status === "claimed") completedUsers += 1;
    if (row.status === "claimed") claimedUsers += 1;
  }

  return { eligibleUsers, completedUsers, claimedUsers };
}