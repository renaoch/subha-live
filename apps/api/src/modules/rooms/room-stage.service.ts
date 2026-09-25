import { redis } from "../../lib/redis";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { mediaConfig } from "../../config/media.config";
import { mediaKeys } from "../media/media.state";
import { mediaService } from "../media";
import { roomState } from "./room-state.service";

/**
 * Stage service for audio "party" rooms.
 *
 * WHY THIS EXISTS
 * ---------------
 * The video room polls the full media state (`GET /media`) from every
 * viewer. That call walks every viewer hash in Redis, so its cost grows
 * with the audience: 10k listeners polling every 2s would mean tens of
 * millions of Redis round trips per minute. Party rooms are audio-only
 * and are meant to hold a large audience, so they use this service
 * instead:
 *
 *  - Listener presence is ONE sorted set (userId -> last seen). Counting
 *    live listeners is ZCOUNT, O(log n), no matter how many there are.
 *  - The state everybody needs (who is on which seat, who is speaking,
 *    how many listeners) is built once per room per second per API
 *    instance and shared by every request in that window.
 *  - The per-user part of a poll (am I seated? is my request pending?)
 *    is a single pipelined Redis round trip.
 *  - Profiles (names/avatars) are only sent when the seat layout changed
 *    (`rev`), keeping the steady-state payload a few hundred bytes.
 *
 * Nothing here scales with the number of listeners except the sorted set
 * itself.
 */

const STAGE_TTL_SECONDS = 60 * 60 * 24;

const k = (roomId: string, name: string) => `stage:${roomId}:${name}`;

const ASSIGN_SEAT_SCRIPT = `
  local seats = KEYS[1]
  local user = ARGV[1]
  local pref = tonumber(ARGV[2])
  local max = tonumber(ARGV[3])
  local ttl = tonumber(ARGV[4])

  local existing = redis.call("HGET", seats, user)
  if existing then
    return tonumber(existing)
  end

  local taken = {}
  for _, v in ipairs(redis.call("HVALS", seats)) do
    taken[tonumber(v)] = true
  end

  local pick = -1
  if pref >= 0 and pref < max and not taken[pref] then
    pick = pref
  else
    for i = 0, max - 1 do
      if not taken[i] then
        pick = i
        break
      end
    end
  end

  if pick >= 0 then
    redis.call("HSET", seats, user, pick)
    redis.call("EXPIRE", seats, ttl)
  end
  return pick
`;

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface StageProfile {
  name: string;
  avatar: string | null;
}

export interface StageParticipant {
  userId: string;
  status: "connecting" | "connected" | "reconnecting" | "offline";
  muted: boolean;
  /** Epoch ms (server clock) of the last "speaking" report, or 0. */
  speakingAt: number;
}

export interface StageSeat extends StageParticipant {
  seat: number;
}

export interface StageSnapshot {
  roomId: string;
  status: string;
  mediaType: string;
  hostId: string;
  rev: number;
  serverTime: number;
  seatCount: number;
  listenerCount: number;
  requestCount: number;
  host: StageParticipant;
  seats: Array<StageSeat | null>;
  /** Suggested next poll delay for a stage member / a plain listener. */
  pollMs: { stage: number; listener: number };
}

export interface StageResponse extends Omit<StageSnapshot, "hostId"> {
  /** Present only when the caller's `rev` is stale. */
  profiles?: Record<string, StageProfile>;
  me: {
    seat: number | null;
    isHost: boolean;
    requestPending: boolean;
  };
}

interface CachedSnapshot {
  expiresAt: number;
  promise: Promise<{
    snapshot: StageSnapshot;
    seatUserIds: Set<string>;
    profileIds: string[];
  }>;
}

/* ------------------------------------------------------------------ */
/* In-process caches                                                    */
/* ------------------------------------------------------------------ */

const snapshotCache = new Map<string, CachedSnapshot>();

const roomCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<RoomRow | null>;
  }
>();

interface RoomRow {
  id: string;
  host_id: string;
  status: string;
  media_type: string;
  max_guest_slots: number | null;
}

const profileCache = new Map<
  string,
  { at: number; profile: StageProfile }
>();

const PROFILE_TTL_MS = 5 * 60_000;
const ROOM_CACHE_MS = 2_000;

const lastPrune = new Map<string, number>();

// Keep the maps from growing forever on a long-lived instance.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of snapshotCache) {
    if (value.expiresAt < now - 10_000) snapshotCache.delete(key);
  }
  for (const [key, value] of roomCache) {
    if (value.expiresAt < now - 10_000) roomCache.delete(key);
  }
  for (const [key, value] of profileCache) {
    if (now - value.at > PROFILE_TTL_MS * 2) profileCache.delete(key);
  }
  for (const [key, at] of lastPrune) {
    if (now - at > 10 * 60_000) lastPrune.delete(key);
  }
}, 60_000).unref?.();

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function safeParse<T>(value: unknown): T | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function loadRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, host_id, status, media_type, max_guest_slots")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to fetch room", {
      code: "ROOM_FETCH_FAILED",
      details: error.message,
    });
  }

  return (data as RoomRow | null) ?? null;
}

/** 2s micro-cache so a poll storm never turns into a Postgres storm. */
function getRoomCached(roomId: string): Promise<RoomRow | null> {
  const now = Date.now();
  const cached = roomCache.get(roomId);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = loadRoom(roomId).catch((error) => {
    roomCache.delete(roomId);
    throw error;
  });
  roomCache.set(roomId, { expiresAt: now + ROOM_CACHE_MS, promise });
  return promise;
}

async function getProfiles(
  userIds: string[],
): Promise<Record<string, StageProfile>> {
  const now = Date.now();
  const result: Record<string, StageProfile> = {};
  const missing: string[] = [];

  for (const id of userIds) {
    const cached = profileCache.get(id);
    if (cached && now - cached.at < PROFILE_TTL_MS) {
      result[id] = cached.profile;
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar")
      .in("id", missing);

    for (const row of (data ?? []) as Array<{
      id: string;
      name: string | null;
      avatar: string | null;
    }>) {
      const profile: StageProfile = {
        name: row.name || "Guest",
        avatar: row.avatar ?? null,
      };
      profileCache.set(row.id, { at: now, profile });
      result[row.id] = profile;
    }

    for (const id of missing) {
      if (!result[id]) result[id] = { name: "Guest", avatar: null };
    }
  }

  return result;
}

function pollFor(listeners: number): { stage: number; listener: number } {
  const p = mediaConfig.stage.poll;
  const listener =
    listeners >= p.largeAudience
      ? p.listenerLargeMs
      : listeners >= p.mediumAudience
        ? p.listenerMediumMs
        : p.listenerSmallMs;
  return { stage: p.stageMs, listener };
}

function seatCapacity(room: RoomRow): number {
  const cap = mediaConfig.limits.maxGuestSlots.audio;
  return Math.max(1, Math.min(room.max_guest_slots ?? cap, cap));
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                             */
/* ------------------------------------------------------------------ */

async function buildSnapshot(roomId: string) {
  const room = await getRoomCached(roomId);

  if (!room) {
    throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  }

  if (room.media_type !== "audio") {
    throw new AppError(409, "Not an audio room", {
      code: "ROOM_NOT_AUDIO",
    });
  }

  const now = Date.now();
  const cutoff = now - mediaConfig.stage.listenerTtlMs;
  const seatCount = seatCapacity(room);

  const [
    hostRaw,
    speakerEntries,
    seatEntries,
    speakingEntries,
    mutedEntries,
    listenerCount,
    requestCount,
    revRaw,
  ] = await Promise.all([
    redis.hget(mediaKeys.media(roomId), "host"),
    redis.hgetall(mediaKeys.speakers(roomId)),
    redis.hgetall(k(roomId, "seats")),
    redis.hgetall(k(roomId, "speaking")),
    redis.hgetall(k(roomId, "muted")),
    redis.zcount(k(roomId, "listeners"), cutoff, "+inf"),
    redis.zcard(roomStateKeyRequests(roomId)),
    redis.get(k(roomId, "rev")),
  ]);

  // Opportunistic, rate-limited trim of listeners that vanished without
  // saying goodbye (closed tab, lost network). Keeps the zset bounded.
  const prunedAt = lastPrune.get(roomId) ?? 0;
  if (now - prunedAt > mediaConfig.stage.pruneEveryMs) {
    lastPrune.set(roomId, now);
    redis
      .zremrangebyscore(k(roomId, "listeners"), "-inf", cutoff - 60_000)
      .catch(() => {});
  }

  const host = safeParse<{
    userId: string;
    status: string;
    lastHeartbeatAt?: number;
    connectedAt?: number;
  }>(hostRaw);

  let hostStatus: StageParticipant["status"] = "offline";
  if (host && host.userId === room.host_id) {
    const beat = host.lastHeartbeatAt || host.connectedAt || 0;
    hostStatus =
      host.status === "connected" &&
      now - beat <= mediaConfig.heartbeat.timeoutMs
        ? "connected"
        : host.status === "connecting"
          ? "connecting"
          : "reconnecting";
  }

  const seatByUser = new Map<string, number>();
  for (const [userId, seat] of Object.entries(
    (seatEntries ?? {}) as Record<string, string>,
  )) {
    const index = Number(seat);
    if (Number.isInteger(index) && index >= 0 && index < seatCount) {
      seatByUser.set(userId, index);
    }
  }

  const speakers = (speakerEntries ?? {}) as Record<string, string>;
  const speaking = (speakingEntries ?? {}) as Record<string, string>;
  const muted = (mutedEntries ?? {}) as Record<string, string>;

  const seats: Array<StageSeat | null> = Array.from(
    { length: seatCount },
    () => null,
  );

  for (const [userId, seat] of seatByUser) {
    const media = safeParse<{
      status: string;
      lastHeartbeatAt?: number;
      joinedAt?: number;
    }>(speakers[userId]);

    let status: StageParticipant["status"] = "connecting";
    if (media) {
      const beat = media.lastHeartbeatAt || media.joinedAt || 0;
      if (media.status === "connected") {
        status =
          now - beat <= mediaConfig.stage.listenerTtlMs
            ? "connected"
            : "reconnecting";
      }
    }

    seats[seat] = {
      seat,
      userId,
      status,
      muted: muted[userId] === "1",
      speakingAt: Number(speaking[userId] ?? 0),
    };
  }

  const snapshot: StageSnapshot = {
    roomId,
    status: room.status,
    mediaType: room.media_type,
    hostId: room.host_id,
    rev: Number(revRaw ?? 0),
    serverTime: now,
    seatCount,
    listenerCount: Number(listenerCount ?? 0),
    requestCount: Number(requestCount ?? 0),
    host: {
      userId: room.host_id,
      status: hostStatus,
      muted: muted[room.host_id] === "1",
      speakingAt: Number(speaking[room.host_id] ?? 0),
    },
    seats,
    pollMs: pollFor(Number(listenerCount ?? 0)),
  };

  return {
    snapshot,
    seatUserIds: new Set(seatByUser.keys()),
    profileIds: [room.host_id, ...seatByUser.keys()],
  };
}

function roomStateKeyRequests(roomId: string): string {
  // Mirrors roomKey(roomId, "requests") in room-state.service.ts.
  return `room:${roomId}:requests`;
}

function getSnapshotCached(roomId: string): CachedSnapshot["promise"] {
  const now = Date.now();
  const cached = snapshotCache.get(roomId);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = buildSnapshot(roomId).catch((error) => {
    snapshotCache.delete(roomId);
    throw error;
  });
  snapshotCache.set(roomId, {
    expiresAt: now + mediaConfig.stage.snapshotCacheMs,
    promise,
  });
  return promise;
}

/* ------------------------------------------------------------------ */
/* Service                                                              */
/* ------------------------------------------------------------------ */

async function bumpRev(roomId: string): Promise<void> {
  await redis.incr(k(roomId, "rev"));
  await redis.expire(k(roomId, "rev"), STAGE_TTL_SECONDS);
  snapshotCache.delete(roomId);
}

export const roomStageService = {
  /** Cached room row; throws 404 / 409 (not live) like the media getRoom(). */
  async getRoomLive(roomId: string): Promise<RoomRow> {
    const room = await getRoomCached(roomId);
    if (!room) {
      throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
    }
    if (room.status !== "live") {
      throw new AppError(409, "Room is not live", { code: "ROOM_NOT_LIVE" });
    }
    return room;
  },

  async getMediaType(roomId: string): Promise<string | null> {
    const room = await getRoomCached(roomId);
    return room?.media_type ?? null;
  },

  /**
   * The poll every participant runs. Also acts as the listener's presence
   * heartbeat (so listeners need no separate heartbeat request at all).
   */
  async getStage(
    roomId: string,
    userId: string,
    knownRev?: number,
  ): Promise<StageResponse> {
    const { snapshot, seatUserIds, profileIds } =
      await getSnapshotCached(roomId);

    const isHost = snapshot.hostId === userId;
    const onStage = isHost || seatUserIds.has(userId);

    // One pipelined round trip per poll: presence + my pending request.
    const pipeline = redis.pipeline();
    if (!onStage) {
      pipeline.zadd(k(roomId, "listeners"), {
        score: Date.now(),
        value: userId,
      });
    }
    pipeline.zscore(roomStateKeyRequests(roomId), userId);
    const results = await pipeline.exec();
    const requestScore = onStage
      ? null
      : results?.[results.length - 1];

    const { hostId: _hostId, ...publicSnapshot } = snapshot;
    void _hostId;

    const response: StageResponse = {
      ...publicSnapshot,
      me: {
        seat: seatUserIds.has(userId)
          ? (publicSnapshot.seats.find((s) => s?.userId === userId)?.seat ??
            null)
          : null,
        isHost,
        requestPending:
          requestScore !== null && requestScore !== undefined,
      },
    };

    if (knownRev === undefined || knownRev !== snapshot.rev) {
      response.profiles = await getProfiles(profileIds);
    }

    return response;
  },

  /** Seat a newly approved speaker. Returns the seat index. */
  async assignSeat(
    roomId: string,
    userId: string,
    seatCount: number,
  ): Promise<number> {
    const prefRaw = await redis.hget(k(roomId, "seatpref"), userId);
    const preferred = prefRaw === null || prefRaw === undefined
      ? -1
      : Number(prefRaw);

    const seat = Number(
      await redis.eval(ASSIGN_SEAT_SCRIPT, {
        keys: [k(roomId, "seats")],
        arguments: [
          userId,
          String(Number.isInteger(preferred) ? preferred : -1),
          String(seatCount),
          String(STAGE_TTL_SECONDS),
        ],
      }),
    );

    await redis.hdel(k(roomId, "seatpref"), userId);

    if (seat < 0) {
      throw new AppError(409, "All guest audio slots are occupied", {
        code: "AUDIO_SLOTS_FULL",
      });
    }

    await bumpRev(roomId);
    return seat;
  },

  async setSeatPreference(
    roomId: string,
    userId: string,
    seat: unknown,
  ): Promise<void> {
    const index = Number(seat);
    if (!Number.isInteger(index) || index < 0 || index >= 32) return;
    await redis.hset(k(roomId, "seatpref"), userId, String(index));
    await redis.expire(k(roomId, "seatpref"), STAGE_TTL_SECONDS);
  },

  async releaseSeat(roomId: string, userId: string): Promise<void> {
    await Promise.all([
      redis.hdel(k(roomId, "seats"), userId),
      redis.hdel(k(roomId, "speaking"), userId),
      redis.hdel(k(roomId, "muted"), userId),
      redis.hdel(k(roomId, "seatpref"), userId),
    ]);
    await bumpRev(roomId);
  },

  /**
   * Host or seated speaker reports their own mic state. Called on change
   * (and every ~2s while speaking) by the few people on stage, never by
   * listeners.
   */
  async report(
    roomId: string,
    userId: string,
    input: { speaking?: boolean; muted?: boolean },
  ): Promise<void> {
    const room = await getRoomCached(roomId);
    if (!room) {
      throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
    }
    if (room.status !== "live") return;

    const isHost = room.host_id === userId;
    if (!isHost) {
      const seated = Boolean(
        Number(await redis.hexists(k(roomId, "seats"), userId)),
      );
      if (!seated) {
        throw new AppError(403, "You are not on stage", {
          code: "STAGE_NOT_ON_STAGE",
        });
      }
    }

    if (typeof input.muted === "boolean") {
      const before = await redis.hget(k(roomId, "muted"), userId);
      const was = before === "1";
      if (input.muted !== was) {
        if (input.muted) {
          await redis.hset(k(roomId, "muted"), userId, "1");
          await redis.hdel(k(roomId, "speaking"), userId);
        } else {
          await redis.hdel(k(roomId, "muted"), userId);
        }
        await redis.expire(k(roomId, "muted"), STAGE_TTL_SECONDS);
        await bumpRev(roomId);
      }
    }

    if (input.speaking === true && input.muted !== true) {
      await redis.hset(k(roomId, "speaking"), userId, String(Date.now()));
      await redis.expire(k(roomId, "speaking"), STAGE_TTL_SECONDS);
    } else if (input.speaking === false) {
      await redis.hdel(k(roomId, "speaking"), userId);
    }
  },

  /* ---------------- listener session bookkeeping ---------------- */

  async saveListenerSession(
    roomId: string,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.hset(k(roomId, "sessions"), userId, sessionId);
    pipeline.expire(k(roomId, "sessions"), STAGE_TTL_SECONDS);
    pipeline.zadd(k(roomId, "listeners"), {
      score: Date.now(),
      value: userId,
    });
    pipeline.expire(k(roomId, "listeners"), STAGE_TTL_SECONDS);
    await pipeline.exec();
  },

  async getListenerSession(
    roomId: string,
    userId: string,
  ): Promise<string | null> {
    const value = await redis.hget(k(roomId, "sessions"), userId);
    return typeof value === "string" && value ? value : null;
  },

  async removeListener(roomId: string, userId: string): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.hdel(k(roomId, "sessions"), userId);
    pipeline.zrem(k(roomId, "listeners"), userId);
    await pipeline.exec();
  },

  /* ---------------- speaker eviction / cleanup ---------------- */

  /**
   * Fully takes a person off the stage: closes their SFU sessions, frees
   * the seat, revokes approval and demotes them back to audience so they
   * can request again later. Used for "leave seat", host kick, and stale
   * speaker cleanup, so all three behave identically.
   */
  async evictSpeaker(roomId: string, userId: string): Promise<void> {
    const provider = await mediaService.getProvider();

    const rawSpeaker = await redis.hget(mediaKeys.speakers(roomId), userId);
    const speaker = safeParse<{ sessionId?: string }>(rawSpeaker);
    if (speaker?.sessionId) {
      await provider.closeSession(speaker.sessionId).catch(() => {});
    }

    // A seated speaker also holds a "stage" listening session (raw tracks).
    const viewer = await mediaService.getViewer(roomId, userId);
    if (viewer?.sessionId) {
      await provider.closeSession(viewer.sessionId).catch(() => {});
    }
    await mediaService.removeViewerSession(roomId, userId).catch(() => {});

    await mediaService.removeSpeakerSession(roomId, userId).catch(() => {});
    await roomState.removeVideoSpeaker(roomId, userId).catch(() => {});
    await roomState.removeSpeaker(roomId, userId).catch(() => {});
    await roomState.removeAudioRequest(roomId, userId).catch(() => {});
    await this.releaseSeat(roomId, userId).catch(() => {});

    await supabase
      .from("room_participants")
      .update({ role: "audience" })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("left_at", null);
  },

  async clearRoom(roomId: string): Promise<void> {
    await redis.del([
      k(roomId, "listeners"),
      k(roomId, "sessions"),
      k(roomId, "seats"),
      k(roomId, "seatpref"),
      k(roomId, "speaking"),
      k(roomId, "muted"),
      k(roomId, "rev"),
    ]);
    snapshotCache.delete(roomId);
    roomCache.delete(roomId);
  },

  invalidateRoom(roomId: string): void {
    roomCache.delete(roomId);
    snapshotCache.delete(roomId);
  },
};