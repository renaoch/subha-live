import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { SetRoomTaskInput } from "./room-task.schema";
import { toRoomTask, type RoomTask, type RoomTaskRow } from "./room-task.types";

async function assertIsHost(roomId: string, userId: string): Promise<void> {
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

  if (room.host_id !== userId) {
    throw new AppError(403, "Only the host can manage this room's task", {
      code: "NOT_ROOM_HOST",
    });
  }
}

export const roomTaskService = {
  /** Public read — viewers and the host both poll this for the live progress bar. */
  async getActiveTask(roomId: string): Promise<RoomTask | null> {
    const { data, error } = await supabase
      .from("room_tasks")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to load room task", {
        code: "ROOM_TASK_LOAD_FAILED",
        details: error.message,
      });
    }

    return data ? toRoomTask(data as RoomTaskRow) : null;
  },

  /** Host sets a new goal. Replaces (cancels) any currently active task. */
  async setTask(
    roomId: string,
    hostId: string,
    input: SetRoomTaskInput,
  ): Promise<RoomTask> {
    await assertIsHost(roomId, hostId);

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

  /** Host cancels the current goal early. */
  async cancelTask(roomId: string, hostId: string): Promise<void> {
    await assertIsHost(roomId, hostId);

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
    const { data: current, error: fetchError } = await supabase
      .from("room_tasks")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .maybeSingle();

    if (fetchError) {
      throw new AppError(500, "Failed to load room task", {
        code: "ROOM_TASK_LOAD_FAILED",
        details: fetchError.message,
      });
    }

    if (!current) return null;

    const row = current as RoomTaskRow;
    const nextValue = row.current_value + amount;
    const completed = nextValue >= row.target_value;

    const { data, error } = await supabase
      .from("room_tasks")
      .update({
        current_value: nextValue,
        status: completed ? "completed" : "active",
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to update room task progress", {
        code: "ROOM_TASK_PROGRESS_FAILED",
        details: error.message,
      });
    }

    return toRoomTask(data as RoomTaskRow);
  },
};
