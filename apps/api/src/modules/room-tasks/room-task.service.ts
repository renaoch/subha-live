import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { cacheGet, cacheSet } from "../../lib/redis";
import type { CreateStarTargetTemplateInput, SetRoomTaskInput } from "./room-task.schema";
import {
  toRoomTask,
  type RoomTask,
  type RoomTaskRow,
  type ClaimRoomTaskResult,
  type ClaimRoomTaskResultRow,
} from "./room-task.types";

/**
 * The Star Target is controlled by the app owners (platform admins) only.
 * Neither the room's host nor an agency owner can create, replace or cancel
 * one — they just see its progress. Because a target can carry a coin reward
 * for viewers, keeping it admin-only also means a host can never mint coins
 * for their own room.
 */
async function assertCanManage(
  roomId: string,
  userId: string,
): Promise<{ hostId: string }> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) {
    throw new AppError(500, "Failed to look up room", {
      code: "ROOM_LOOKUP_FAILED",
      details: roomError.message,
    });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = Boolean(profile?.is_admin);

  if (!isAdmin) {
    throw new AppError(403, "Only the app owners can manage the Star Target", {
      code: "ROOM_TASK_FORBIDDEN",
    });
  }
  return { hostId: room.host_id as string };
}

async function assertAdmin(actorId: string): Promise<void> {
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", actorId).maybeSingle();
  if (!profile?.is_admin) {
    throw new AppError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
  }
}

function firstRow<T>(data: T[] | T | null | undefined): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/** Cache "this room has no star target" briefly — viewers poll the task every few seconds. */
const NO_TARGET_TTL_SECONDS = 8;
const noTargetKey = (roomId: string) => `room:star:none:${roomId}`;

/**
 * Creates this room's Star Target from the applicable admin-defined template
 * (host-specific beats all-lives) if it doesn't have one yet. Idempotent.
 */
async function ensureForRoom(roomId: string): Promise<RoomTaskRow | null> {
  const { data, error } = await supabase.rpc("ensure_room_star_target" as any, { p_room_id: roomId });
  if (error) {
    throw new AppError(500, "Failed to prepare room star target", {
      code: "ROOM_TASK_ENSURE_FAILED",
      details: error.message,
    });
  }
  return firstRow<RoomTaskRow>(data as RoomTaskRow[] | RoomTaskRow | null);
}

export interface StarTargetTemplate {
  id: string;
  title: string;
  targetValue: number;
  rewardCoins: number;
  hostId: string | null;
  hostName: string | null;
  scope: "all" | "host";
  isActive: boolean;
  createdAt: string;
  runningRooms: number;
  completedRooms: number;
}

export const roomTaskService = {
  /** Admin console: the newest Star Targets across every room, with room + host names. */
  async adminList(actorId: string, limit = 50): Promise<Array<RoomTask & { roomTitle: string | null; hostName: string | null }>> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", actorId)
      .maybeSingle();
    if (!profile?.is_admin) {
      throw new AppError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
    }

    const { data, error } = await supabase
      .from("room_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error) {
      throw new AppError(500, "Failed to list star targets", {
        code: "ROOM_TASK_LIST_FAILED",
        details: error.message,
      });
    }

    const rows = (data ?? []) as RoomTaskRow[];
    const roomIds = [...new Set(rows.map((r) => r.room_id))];
    const hostIds = [...new Set(rows.map((r) => r.host_id))];

    const [{ data: rooms }, { data: hosts }] = await Promise.all([
      roomIds.length ? supabase.from("rooms").select("id, title").in("id", roomIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
      hostIds.length ? supabase.from("profiles").select("id, name").in("id", hostIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    ]);
    const roomTitle = new Map((rooms ?? []).map((r) => [r.id, r.title as string | null]));
    const hostName = new Map((hosts ?? []).map((h) => [h.id, h.name as string | null]));

    return rows.map((row) => ({
      ...toRoomTask(row),
      roomTitle: roomTitle.get(row.room_id) ?? null,
      hostName: hostName.get(row.host_id) ?? null,
    }));
  },

  /**
   * Public read — viewers and the host both poll this for the live progress
   * bar. Also returns the most recently completed/cancelled task briefly so
   * a viewer who just finished it sees the CLAIM state instead of the card
   * disappearing, so we look up "active" first, then fall back to the most
   * recent "completed" one within the room.
   *
   * When `userId` is passed, includes whether *that* user has already
   * claimed the reward, so the frontend can render CLAIMED vs CLAIMABLE
   * without a second round trip.
   */
  async getActiveTask(roomId: string, userId?: string): Promise<RoomTask | null> {
    const { data, error } = await supabase
      .from("room_tasks")
      .select("*")
      .eq("room_id", roomId)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to load room task", {
        code: "ROOM_TASK_LOAD_FAILED",
        details: error.message,
      });
    }

    let row = data as RoomTaskRow | null;
    if (!row) {
      // No run yet in this room: start one from the admin's global / per-host
      // target if there is one. A short negative cache keeps the 5s viewer
      // polling from hitting the database when nothing applies.
      if (await cacheGet<number>(noTargetKey(roomId))) return null;
      row = await ensureForRoom(roomId);
      if (!row) {
        await cacheSet(noTargetKey(roomId), 1, NO_TARGET_TTL_SECONDS);
        return null;
      }
    }


    if (!userId || row.reward_coins <= 0) {
      return toRoomTask(row);
    }

    const { data: claim, error: claimError } = await supabase
      .from("room_task_claims")
      .select("claimed_at")
      .eq("room_task_id", row.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (claimError) {
      throw new AppError(500, "Failed to load claim status", {
        code: "ROOM_TASK_CLAIM_LOOKUP_FAILED",
        details: claimError.message,
      });
    }

    return toRoomTask(row, claim ?? null);
  },

  /** App owner (admin) sets a new goal for the room. Replaces (cancels) any currently active task. */
  async setTask(
    roomId: string,
    actorId: string,
    input: SetRoomTaskInput,
  ): Promise<RoomTask> {
    const { hostId } = await assertCanManage(roomId, actorId);
    const rewardCoins = input.rewardCoins ?? 0;

    const { error: cancelError } = await supabase
      .from("room_tasks")
      .update({ status: "cancelled" })
      .eq("room_id", roomId)
      .eq("status", "active");

    if (cancelError) {
      throw new AppError(500, "Failed to replace existing room task", {
        code: "ROOM_TASK_REPLACE_FAILED",
        details: cancelError.message,
      });
    }

    const { data, error } = await supabase
      .from("room_tasks")
      .insert({
        room_id: roomId,
        host_id: hostId,
        title: input.title,
        target_value: input.targetValue,
        reward_coins: rewardCoins,
        current_value: 0,
        status: "active",
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to create room task", {
        code: "ROOM_TASK_CREATE_FAILED",
        details: error.message,
      });
    }

    return toRoomTask(data as RoomTaskRow);
  },

  /** Admin cancels the current goal early. */
  async cancelTask(roomId: string, actorId: string): Promise<void> {
    await assertCanManage(roomId, actorId);

    const { error } = await supabase
      .from("room_tasks")
      .update({ status: "cancelled" })
      .eq("room_id", roomId)
      .eq("status", "active");

    if (error) {
      throw new AppError(500, "Failed to cancel room task", {
        code: "ROOM_TASK_CANCEL_FAILED",
        details: error.message,
      });
    }
  },

  /**
   * Bumps the active task's progress by `amount` (e.g. a gift's coin
   * value). Silently a no-op if there's no active task — callers that
   * hook this into gift-sending should treat it as best-effort and
   * never let it fail the gift itself.
   */
  async bumpProgress(roomId: string, amount: number): Promise<RoomTask | null> {
    if (!(amount > 0)) return null;

    const bump = async (): Promise<RoomTaskRow | null> => {
      // One atomic UPDATE in Postgres (bump_room_task) — concurrent gifts can
      // never overwrite each other's progress.
      const { data, error } = await supabase.rpc("bump_room_task" as any, {
        p_room_id: roomId,
        p_amount: Math.floor(amount),
      });
      if (error) {
        throw new AppError(500, "Failed to update room task progress", {
          code: "ROOM_TASK_PROGRESS_FAILED",
          details: error.message,
        });
      }
      return firstRow<RoomTaskRow>(data as RoomTaskRow[] | RoomTaskRow | null);
    };

    let row = await bump();
    if (!row) {
      // The first gift can land before anyone polled the room's target.
      if (await ensureForRoom(roomId)) row = await bump();
    }
    return row ? toRoomTask(row) : null;
  },

  /**
   * Claim the coin reward for a completed room task.
   *
   * All correctness lives in the `claim_room_task_reward` SQL function
   * (see supabase/migrations/20260829120000_room_task_rewards.sql):
   * it locks the task row, verifies status = 'completed', inserts the
   * claim under a UNIQUE(room_task_id, user_id) constraint, and credits
   * `profiles.coins` — all in one transaction. That means this call is
   * safe to fire from double-clicks, multiple tabs, or racing retries;
   * at most one of them will ever succeed in crediting coins, and the
   * rest will fail with ROOM_TASK_ALREADY_CLAIMED.
   */
  async claimReward(roomTaskId: string, userId: string): Promise<ClaimRoomTaskResult> {
    const { data, error } = await supabase.rpc("claim_room_task_reward", {
      p_room_task_id: roomTaskId,
      p_user_id: userId,
    });

    if (error) {
      const message = error.message ?? "";

      if (message.includes("ROOM_TASK_NOT_FOUND")) {
        throw new AppError(404, "Task not found", { code: "ROOM_TASK_NOT_FOUND" });
      }
      if (message.includes("ROOM_TASK_NOT_COMPLETED")) {
        throw new AppError(400, "Task has not been completed yet", {
          code: "ROOM_TASK_NOT_COMPLETED",
        });
      }
      if (message.includes("ROOM_TASK_NO_REWARD")) {
        throw new AppError(400, "This task has no reward to claim", {
          code: "ROOM_TASK_NO_REWARD",
        });
      }
      if (message.includes("ROOM_TASK_ALREADY_CLAIMED")) {
        throw new AppError(409, "Reward already claimed", {
          code: "ROOM_TASK_ALREADY_CLAIMED",
        });
      }
      if (message.includes("USER_NOT_FOUND")) {
        throw new AppError(404, "User not found", { code: "USER_NOT_FOUND" });
      }

      throw new AppError(500, "Failed to claim task reward", {
        code: "ROOM_TASK_CLAIM_FAILED",
        details: message,
      });
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | ClaimRoomTaskResultRow
      | undefined;

    if (!row) {
      throw new AppError(500, "Claim did not return a result", {
        code: "ROOM_TASK_CLAIM_FAILED",
      });
    }

    return {
      taskId: roomTaskId,
      rewardCoins: row.reward_coins,
      newCoins: row.new_coins,
      claimedAt: row.claimed_at,
    };
  },
  // ---------------- Admin: global / per-host Star Targets ----------------

  async adminListTemplates(actorId: string): Promise<StarTargetTemplate[]> {
    await assertAdmin(actorId);
    const { data, error } = await (supabase.from("star_target_templates" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      throw new AppError(500, "Failed to list star targets", { code: "STAR_TARGET_LIST_FAILED", details: error.message });
    }
    const rows = (data ?? []) as any[];
    const ids = rows.map((r) => r.id);
    const hostIds = [...new Set(rows.map((r) => r.host_id).filter(Boolean))] as string[];

    const [runs, hosts] = await Promise.all([
      ids.length
        ? supabase.from("room_tasks").select("template_id, status").in("template_id" as any, ids)
        : Promise.resolve({ data: [] as any[] }),
      hostIds.length
        ? supabase.from("profiles").select("id, name").in("id", hostIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    ]);
    const hostName = new Map((hosts.data ?? []).map((h: any) => [h.id, h.name as string | null]));
    const counts = new Map<string, { running: number; completed: number }>();
    for (const r of (runs.data ?? []) as any[]) {
      const c = counts.get(r.template_id) ?? { running: 0, completed: 0 };
      if (r.status === "active") c.running++;
      if (r.status === "completed") c.completed++;
      counts.set(r.template_id, c);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      targetValue: r.target_value,
      rewardCoins: r.reward_coins,
      hostId: r.host_id ?? null,
      hostName: r.host_id ? (hostName.get(r.host_id) ?? null) : null,
      scope: r.host_id ? ("host" as const) : ("all" as const),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      runningRooms: counts.get(r.id)?.running ?? 0,
      completedRooms: counts.get(r.id)?.completed ?? 0,
    }));
  },

  async adminCreateTemplate(actorId: string, input: CreateStarTargetTemplateInput): Promise<string> {
    await assertAdmin(actorId);
    if (input.hostId) {
      const { data: host } = await supabase.from("profiles").select("id").eq("id", input.hostId).maybeSingle();
      if (!host) throw new AppError(404, "Host not found", { code: "HOST_NOT_FOUND" });
    }
    const { data, error } = await supabase.rpc("publish_star_target" as any, {
      p_title: input.title,
      p_target_value: input.targetValue,
      p_reward_coins: input.rewardCoins ?? 0,
      p_host_id: input.hostId ?? null,
      p_created_by: actorId,
    });
    if (error) {
      throw new AppError(500, "Failed to create star target", { code: "STAR_TARGET_CREATE_FAILED", details: error.message });
    }
    return data as string;
  },

  async adminEndTemplate(actorId: string, templateId: string): Promise<void> {
    await assertAdmin(actorId);
    const { error } = await supabase.rpc("end_star_target" as any, { p_template_id: templateId });
    if (error) {
      throw new AppError(500, "Failed to end star target", { code: "STAR_TARGET_END_FAILED", details: error.message });
    }
  },

  /** Host picker for the admin form: match by name, handle or public ID. */
  async adminSearchHosts(actorId: string, query: string) {
    await assertAdmin(actorId);
    const q = query.replace(/[%,()*\\]/g, " ").trim().slice(0, 40);
    if (q.length < 2) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, handle, public_id, avatar")
      .or(`name.ilike.%${q}%,handle.ilike.%${q}%,public_id.eq.${q}`)
      .limit(15);
    if (error) {
      throw new AppError(500, "Host search failed", { code: "HOST_SEARCH_FAILED", details: error.message });
    }
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? "",
      handle: (p.handle as string | null) ?? "",
      publicId: (p.public_id as string | null) ?? null,
      avatar: (p.avatar as string | null) ?? null,
    }));
  },
};