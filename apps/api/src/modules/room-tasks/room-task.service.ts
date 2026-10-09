import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { SetRoomTaskInput } from "./room-task.schema";
import {
  toRoomTask,
  type RoomTask,
  type RoomTaskRow,
  type ClaimRoomTaskResult,
  type ClaimRoomTaskResultRow,
} from "./room-task.types";

/**
 * The room's own host may set/cancel the Star Target (a pure goal, no payout);
 * platform admins may also attach a coin reward for viewers. Rewards that mint
 * coins are admin-only so a host can never create coins for their own viewers.
 */
async function assertCanManage(
  roomId: string,
  userId: string,
): Promise<{ hostId: string; isAdmin: boolean }> {
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

  if (room.host_id !== userId && !isAdmin) {
    throw new AppError(403, "Only the room host or an admin can manage the Star Target", {
      code: "ROOM_TASK_FORBIDDEN",
    });
  }
  return { hostId: room.host_id as string, isAdmin };
}

export const roomTaskService = {
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

    if (!data) return null;

    const row = data as RoomTaskRow;

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

  /** Admin sets a new goal for the room. Replaces (cancels) any currently active task. */
  async setTask(
    roomId: string,
    actorId: string,
    input: SetRoomTaskInput,
  ): Promise<RoomTask> {
    const { hostId, isAdmin } = await assertCanManage(roomId, actorId);
    const rewardCoins = isAdmin ? (input.rewardCoins ?? 0) : 0;

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
    const row = (Array.isArray(data) ? data[0] : data) as RoomTaskRow | undefined;
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
};
