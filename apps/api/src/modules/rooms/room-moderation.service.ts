import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import { roomMediaService } from "./room-media.service";
import { roomModerationState } from "./room-moderation.state";

async function assertHostModeratesOther(roomId: string, hostId: string, targetId: string) {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to fetch room", { code: "ROOM_FETCH_FAILED", details: error.message });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  if (room.host_id !== hostId) {
    throw new AppError(403, "Only the room host can do this", { code: "ROOM_HOST_REQUIRED" });
  }
  if (targetId === room.host_id) {
    throw new AppError(400, "You cannot moderate yourself", { code: "ROOM_CANNOT_MODERATE_HOST" });
  }
}

async function quiet(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[roomModeration] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

/**
 * The viewer client auto-publishes its mic while its latest speaker request is
 * "accepted". Close it, or a kicked speaker would instantly re-publish.
 */
async function closeAcceptedRequest(roomId: string, userId: string) {
  await quiet("closeAcceptedRequest", async () => {
    await supabase
      .from("room_join_requests")
      .update({ status: "cancelled" })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("status", "accepted");
  });
}

/** Take a user off the stage / out of the stream completely. */
async function removeFromRoom(roomId: string, userId: string) {
  await closeAcceptedRequest(roomId, userId);
  await quiet("unpublishGuest", () => roomMediaService.unpublishGuest(roomId, userId));
  await quiet("leaveViewer", () => roomMediaService.leaveViewer(roomId, userId));
  await quiet("removeAudioRequest", () => roomState.removeAudioRequest(roomId, userId));
  await quiet("removeViewer", () => roomState.removeViewer(roomId, userId));
  await quiet("participant", async () => {
    await supabase
      .from("room_participants")
      .update({ left_at: new Date().toISOString(), role: "audience" })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  });
}

export const roomModerationService = {
  /** Block: removed from the stream, can't rejoin, room hidden from them. */
  async block(roomId: string, hostId: string, targetId: string) {
    await assertHostModeratesOther(roomId, hostId, targetId);
    await roomModerationState.add(roomId, targetId, "block", hostId);
    await removeFromRoom(roomId, targetId);
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  async unblock(roomId: string, hostId: string, targetId: string) {
    await assertHostModeratesOther(roomId, hostId, targetId);
    await roomModerationState.remove(roomId, targetId, "block");
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  /** Mute: can't comment; if speaking, mic is force-muted (client enforces). */
  async mute(roomId: string, hostId: string, targetId: string) {
    await assertHostModeratesOther(roomId, hostId, targetId);
    await roomModerationState.add(roomId, targetId, "mute", hostId);
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  async unmute(roomId: string, hostId: string, targetId: string) {
    await assertHostModeratesOther(roomId, hostId, targetId);
    await roomModerationState.remove(roomId, targetId, "mute");
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  /** Kick a speaker back to being a viewer (fully tears down their mic session). */
  async kickSpeaker(roomId: string, hostId: string, targetId: string) {
    await assertHostModeratesOther(roomId, hostId, targetId);
    await closeAcceptedRequest(roomId, targetId);
    await roomMediaService.unpublishGuest(roomId, targetId);
    await quiet("demote", async () => {
      await supabase
        .from("room_participants")
        .update({ role: "audience" })
        .eq("room_id", roomId)
        .eq("user_id", targetId)
        .is("left_at", null);
    });
  },

  /** Host-only: who is blocked / muted, with names for the UI. */
  async list(roomId: string, hostId: string) {
    const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
    if (!room || room.host_id !== hostId) {
      throw new AppError(403, "Only the room host can do this", { code: "ROOM_HOST_REQUIRED" });
    }
    const rows = await roomModerationState.list(roomId);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const profiles = new Map<string, { id: string; name: string | null; avatar: string | null; handle: string | null }>();
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, name, avatar, handle").in("id", ids);
      for (const p of data ?? []) profiles.set(p.id, p as never);
    }
    const shape = (kind: "block" | "mute") =>
      rows
        .filter((r) => r.kind === kind)
        .map((r) => profiles.get(r.user_id) ?? { id: r.user_id, name: null, avatar: null, handle: null });
    return { blocked: shape("block"), muted: shape("mute") };
  },

  /** Anyone: my own status in this room. */
  async me(roomId: string, userId: string) {
    const [blocked, muted] = await Promise.all([
      roomModerationState.isBlocked(roomId, userId),
      roomModerationState.isMuted(roomId, userId),
    ]);
    return { blocked, muted };
  },
};