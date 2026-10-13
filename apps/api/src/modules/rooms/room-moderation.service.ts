import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { roomState } from "./room-state.service";
import { roomMediaService } from "./room-media.service";
import { roomModerationState, type ModerationKind } from "./room-moderation.state";

type Actor = { isHost: boolean; isModerator: boolean };

/** Host, or a participant whose role is "moderator" in this room. */
async function resolveActor(roomId: string, actorId: string): Promise<Actor> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "Failed to fetch room", { code: "ROOM_FETCH_FAILED", details: error.message });
  }
  if (!room) throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  if (room.host_id === actorId) return { isHost: true, isModerator: false };

  const { data: p } = await supabase
    .from("room_participants")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", actorId)
    .is("left_at", null)
    .maybeSingle();
  return { isHost: false, isModerator: p?.role === "moderator" };
}

/**
 * Server-side authorization for every moderation action. Opening someone's
 * profile never grants this: only the host / a moderator pass, and nobody may
 * target the host, themselves, or (as a moderator) another moderator.
 */
async function assertCanModerate(roomId: string, actorId: string, targetId: string): Promise<Actor> {
  const actor = await resolveActor(roomId, actorId);
  if (!actor.isHost && !actor.isModerator) {
    throw new AppError(403, "You don't have permission to moderate this room", { code: "ROOM_MODERATOR_REQUIRED" });
  }
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (targetId === actorId || targetId === room?.host_id) {
    throw new AppError(400, "You cannot moderate this participant", { code: "ROOM_CANNOT_MODERATE_TARGET" });
  }
  if (!actor.isHost) {
    const { data: t } = await supabase
      .from("room_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetId)
      .is("left_at", null)
      .maybeSingle();
    if (t?.role === "moderator") {
      throw new AppError(403, "Moderators cannot moderate other moderators", { code: "ROOM_CANNOT_MODERATE_TARGET" });
    }
  }
  return actor;
}

/** Reversing a restriction: the host always may; a moderator only their own. */
async function assertCanReverse(roomId: string, actorId: string, targetId: string, kind: ModerationKind) {
  const actor = await assertCanModerate(roomId, actorId, targetId);
  if (actor.isHost) return;
  const creator = await roomModerationState.creatorOf(roomId, targetId, kind);
  if (creator && creator !== actorId) {
    throw new AppError(403, "Only the host or the moderator who applied this can reverse it", {
      code: "ROOM_MODERATION_NOT_OWNER",
    });
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
  async block(roomId: string, actorId: string, targetId: string) {
    await assertCanModerate(roomId, actorId, targetId);
    await roomModerationState.add(roomId, targetId, "block", actorId);
    await removeFromRoom(roomId, targetId);
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  /** Removes ONLY the room block — mic/chat restrictions are left untouched. */
  async unblock(roomId: string, actorId: string, targetId: string) {
    await assertCanReverse(roomId, actorId, targetId, "block");
    await roomModerationState.remove(roomId, targetId, "block");
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  /** Restrict chat: can't send messages. Does NOT touch their mic. */
  async mute(roomId: string, actorId: string, targetId: string) {
    await assertCanModerate(roomId, actorId, targetId);
    await roomModerationState.add(roomId, targetId, "mute", actorId);
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },
  async unmute(roomId: string, actorId: string, targetId: string) {
    await assertCanReverse(roomId, actorId, targetId, "mute");
    await roomModerationState.remove(roomId, targetId, "mute");
    await roomModerationState.invalidateChatAuth(roomId, targetId);
  },

  /** Mute microphone (speakers): silences their mic. Does NOT touch chat. */
  async muteMic(roomId: string, actorId: string, targetId: string) {
    await assertCanModerate(roomId, actorId, targetId);
    await roomModerationState.add(roomId, targetId, "mic", actorId);
  },
  async unmuteMic(roomId: string, actorId: string, targetId: string) {
    await assertCanReverse(roomId, actorId, targetId, "mic");
    await roomModerationState.remove(roomId, targetId, "mic");
  },

  /** Remove from stage: back to viewer. Stays in the room. */
  async kickSpeaker(roomId: string, actorId: string, targetId: string) {
    await assertCanModerate(roomId, actorId, targetId);
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

  /** Kick from room: removed now, NOT blocked — may rejoin by the normal rules. */
  async kick(roomId: string, actorId: string, targetId: string) {
    await assertCanModerate(roomId, actorId, targetId);
    await roomModerationState.markKicked(roomId, targetId);
    await removeFromRoom(roomId, targetId);
  },

  /** Moderators + host: current restrictions with names for the UI. */
  async list(roomId: string, actorId: string) {
    const actor = await resolveActor(roomId, actorId);
    if (!actor.isHost && !actor.isModerator) {
      throw new AppError(403, "You don't have permission to moderate this room", { code: "ROOM_MODERATOR_REQUIRED" });
    }
    const rows = await roomModerationState.list(roomId);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const profiles = new Map<string, { id: string; name: string | null; avatar: string | null; handle: string | null }>();
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, name, avatar, handle").in("id", ids);
      for (const p of data ?? []) profiles.set(p.id, p as never);
    }
    const shape = (kind: ModerationKind) =>
      rows
        .filter((r) => r.kind === kind)
        .map((r) => ({
          ...(profiles.get(r.user_id) ?? { id: r.user_id, name: null, avatar: null, handle: null }),
          createdBy: r.created_by,
          // The host can reverse everything; a moderator only their own actions.
          canReverse: actor.isHost || r.created_by === actorId,
        }));
    return { blocked: shape("block"), muted: shape("mute"), micMuted: shape("mic") };
  },

  /** Anyone: my own status + whether I may moderate (drives which menus show). */
  async me(roomId: string, userId: string) {
    const [actor, blocked, muted, micMuted] = await Promise.all([
      resolveActor(roomId, userId),
      roomModerationState.isBlocked(roomId, userId),
      roomModerationState.isMuted(roomId, userId),
      roomModerationState.isMicMuted(roomId, userId),
    ]);
    return { blocked, muted, micMuted, isHost: actor.isHost, canModerate: actor.isHost || actor.isModerator };
  },
};
