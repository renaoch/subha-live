import { redis } from "../../lib/redis";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

/**
 * Room moderation state (block / mute), cheap to read on hot paths.
 *
 * Source of truth: `room_moderation` table. Redis sets are a read cache
 * (hydrated lazily per room) so checks on join / poll / heartbeat are a single
 * SISMEMBER. If Redis is unavailable we fall back to the table, so a Redis
 * outage can never let a blocked user back in.
 *
 * This file must NOT import the media services (they import this file).
 */

export type ModerationKind = "block" | "mute";

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const setKey = (roomId: string, kind: ModerationKind) => `room:${roomId}:mod:${kind}`;
const loadedKey = (roomId: string) => `room:${roomId}:mod:loaded`;

const table = () => supabase.from("room_moderation" as any) as any;

async function hydrate(roomId: string): Promise<void> {
  if (await redis.get(loadedKey(roomId))) return;
  const { data, error } = await table().select("user_id, kind").eq("room_id", roomId);
  if (error) throw error;
  for (const row of (data ?? []) as { user_id: string; kind: ModerationKind }[]) {
    await redis.sadd(setKey(roomId, row.kind), row.user_id);
    await redis.expire(setKey(roomId, row.kind), CACHE_TTL_SECONDS);
  }
  await redis.set(loadedKey(roomId), "1", { EX: CACHE_TTL_SECONDS, ex: CACHE_TTL_SECONDS });
}

async function dbHas(roomId: string, userId: string, kind: ModerationKind): Promise<boolean> {
  const { data } = await table()
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  return !!data;
}

async function has(roomId: string, userId: string, kind: ModerationKind): Promise<boolean> {
  try {
    await hydrate(roomId);
    return Number(await redis.sismember(setKey(roomId, kind), userId)) === 1;
  } catch {
    return dbHas(roomId, userId, kind);
  }
}

export const roomModerationState = {
  isBlocked: (roomId: string, userId: string) => has(roomId, userId, "block"),
  isMuted: (roomId: string, userId: string) => has(roomId, userId, "mute"),

  /** Throws 403 ROOM_BLOCKED when the user has been blocked by the host. */
  async assertNotBlocked(roomId: string, userId: string): Promise<void> {
    if (await has(roomId, userId, "block")) {
      throw new AppError(403, "You have been blocked from this room", { code: "ROOM_BLOCKED" });
    }
  },

  async getMutedIds(roomId: string): Promise<string[]> {
    try {
      await hydrate(roomId);
      return ((await redis.smembers(setKey(roomId, "mute"))) ?? []) as string[];
    } catch {
      const { data } = await table().select("user_id").eq("room_id", roomId).eq("kind", "mute");
      return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    }
  },

  async add(roomId: string, userId: string, kind: ModerationKind, createdBy: string): Promise<void> {
    const { error } = await table().upsert(
      { room_id: roomId, user_id: userId, kind, created_by: createdBy },
      { onConflict: "room_id,user_id,kind" },
    );
    if (error) {
      throw new AppError(500, "Failed to save moderation action", {
        code: "ROOM_MODERATION_SAVE_FAILED",
        details: error.message,
      });
    }
    await redis.sadd(setKey(roomId, kind), userId).catch(() => {});
  },

  async remove(roomId: string, userId: string, kind: ModerationKind): Promise<void> {
    const { error } = await table()
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("kind", kind);
    if (error) {
      throw new AppError(500, "Failed to save moderation action", {
        code: "ROOM_MODERATION_SAVE_FAILED",
        details: error.message,
      });
    }
    await redis.srem(setKey(roomId, kind), userId).catch(() => {});
  },

  /** Rooms this user is blocked from — used to hide those rooms from them. */
  async blockedRoomIdsFor(userId: string): Promise<Set<string>> {
    const { data } = await table().select("room_id").eq("user_id", userId).eq("kind", "block");
    return new Set(((data ?? []) as { room_id: string }[]).map((r) => r.room_id));
  },

  async list(roomId: string): Promise<{ user_id: string; kind: ModerationKind }[]> {
    const { data, error } = await table().select("user_id, kind").eq("room_id", roomId);
    if (error) {
      throw new AppError(500, "Failed to load moderation list", {
        code: "ROOM_MODERATION_LIST_FAILED",
        details: error.message,
      });
    }
    return (data ?? []) as { user_id: string; kind: ModerationKind }[];
  },

  /**
   * The chat service caches room authorization (incl. mute/ban) for ~30s.
   * Dropping that cache key makes a mute/block take effect immediately when the
   * chat service shares this Redis; otherwise it applies once the TTL expires.
   */
  async invalidateChatAuth(roomId: string, userId: string): Promise<void> {
    await redis.del(`chat:auth:${userId}:${roomId}`).catch(() => {});
  },
};