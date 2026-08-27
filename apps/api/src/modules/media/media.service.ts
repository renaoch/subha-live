import { randomUUID } from "node:crypto";

import { redis } from "../../lib/redis";

import { mediaConfig } from "../../config/media.config";

import {
  MediaGenerationMismatchError,
  MediaStateConflictError,
} from "./media.errors";

import {
  createMediaEvent,
  type MediaEvent,
  type MediaEventType,
} from "./media.events";

import {
  mediaKeys,
} from "./media.state";

import { roomState } from "../rooms/room-state.service";

import type {
  MediaParticipantRole,
  MediaSession,
  RoomMediaState,
} from "./media.types";

import type { MediaProvider } from "./media.provider";

export interface MediaServiceDependencies {
  provider: MediaProvider;
}

function now(): number {
  return Date.now();
}

function createEmptyRoomState(
  roomId: string,
): RoomMediaState {
  return {
    roomId,

    status: "idle",

    generation: 0,

    sequence: 0,

    host: null,

    speakers: {},

    viewers: {},

    viewerCount: 0,

    updatedAt: now(),
  };
}

function parseRedisJson<T>(
  value: unknown,
): T {
  if (typeof value !== "string") {
    throw new TypeError(
      "Expected Redis value to be a string",
    );
  }

  return JSON.parse(value) as T;
}

async function normalizeViewerCollectionKey(
  roomId: string,
): Promise<string[]> {
  const collectionKey =
    mediaKeys.viewers(roomId);

  const keyType =
    await redis.type(collectionKey);

  if (keyType === "none") {
    return [];
  }

  if (keyType === "set") {
    return redis.smembers(
      collectionKey,
    );
  }

  /*
   * Older/broken deployments used this same key as a HASH of
   * viewer JSON. Migrate that data once to the correct layout:
   *   collection key -> SET of user IDs
   *   viewer:<userId> -> HASH of viewer state
   */
  if (keyType === "hash") {
    const legacyEntries =
      await redis.hgetall(
        collectionKey,
      );

    const viewerIds: string[] = [];

    await redis.del(
      collectionKey,
    );

    for (const [
      userId,
      value,
    ] of Object.entries(
      legacyEntries,
    ) as Array<[string, string]>) {
      let parsed: Record<
        string,
        unknown
      >;

      try {
        parsed = JSON.parse(value) as Record<
          string,
          unknown
        >;
      } catch {
        continue;
      }

      const actualUserId =
        typeof parsed.userId === "string" &&
        parsed.userId
          ? parsed.userId
          : userId;

      viewerIds.push(
        actualUserId,
      );

      await redis.hset(
        mediaKeys.viewer(
          roomId,
          actualUserId,
        ),
        {
          userId: actualUserId,
          sessionId:
            typeof parsed.sessionId === "string"
              ? parsed.sessionId
              : "",
          generation: String(
            Number(parsed.generation ?? 0),
          ),
          status:
            typeof parsed.status === "string"
              ? parsed.status
              : "connected",
          joinedAt: String(
            Number(
              parsed.joinedAt ??
                parsed.connectedAt ??
                0,
            ),
          ),
          lastHeartbeatAt: String(
            Number(
              parsed.lastHeartbeatAt ??
                0,
            ),
          ),
          lastSequence: String(
            Number(
              parsed.lastSequence ?? 0,
            ),
          ),
        },
      );
    }

    if (viewerIds.length > 0) {
      await redis.sadd(
        collectionKey,
        viewerIds,
      );
    }

    return viewerIds;
  }

  /*
   * The key has an unexpected Redis type. Remove it so the next
   * write can recreate the collection as the correct SET.
   */
  await redis.del(
    collectionKey,
  );

  return [];
}

export function createMediaService(
  dependencies: MediaServiceDependencies,
) {
  const { provider } =
    dependencies;

  return {
    async getRoomState(
      roomId: string,
    ): Promise<RoomMediaState> {
      const raw =
        await redis.hgetall(
          mediaKeys.media(roomId),
        );

      if (
        !raw ||
        Object.keys(raw).length ===
          0
      ) {
        return createEmptyRoomState(
          roomId,
        );
      }

      let host:
        | RoomMediaState["host"]
        | null = null;

      if (raw.host) {
        host =
          parseRedisJson<
            NonNullable<
              RoomMediaState["host"]
            >
          >(raw.host);
      }

      const speakers:
        RoomMediaState["speakers"] =
        {};

      const speakerEntries =
        await redis.hgetall(
          mediaKeys.speakers(
            roomId,
          ),
        );

      const staleSpeakerIds: string[] = [];

      for (const [
        userId,
        value,
      ] of Object.entries(
        speakerEntries,
      )) {
        const speaker =
          parseRedisJson<
            RoomMediaState["speakers"][string]
          >(value);

        /*
         * A speaker can get permanently stuck in "connecting" if
         * the guest's PeerConnection never reaches "connected" (e.g.
         * a TURN/NAT failure) and their browser tab closes/crashes
         * before the cleanup call (unpublishGuest) can run. With
         * nothing to detect this, that entry sits in Redis forever:
         * every host/viewer poll sees "a speaker exists", tries to
         * subscribe, and gets a 409 "No guest audio is active" —
         * on an infinite loop, since a stuck "connecting" entry
         * never becomes a real, subscribable track.
         *
         * Treat any "connecting" speaker older than
         * mediaConfig.session.staleAfterMs as abandoned: drop it
         * from the state we return (so callers stop trying to
         * subscribe to it this tick) and clean it up in Redis (so
         * it doesn't keep coming back on the next read).
         */
        if (
          speaker.status === "connecting" &&
          now() - speaker.joinedAt > mediaConfig.session.staleAfterMs
        ) {
          staleSpeakerIds.push(userId);
          continue;
        }

        speakers[userId] = speaker;
      }

      if (staleSpeakerIds.length > 0) {
        await redis.hdel(
          mediaKeys.speakers(roomId),
          staleSpeakerIds,
        );

        // Also release the room-level "speaker slot" reservation and any
        // Cloudflare session, or a stale entry here would keep the guest
        // slot count full and leak the session even after being reaped
        // from the state hash above.
        await Promise.all(
          staleSpeakerIds.map(async (userId) => {
            await roomState
              .removeVideoSpeaker(roomId, userId)
              .catch(() => {});
            await roomState
              .removeSpeaker(roomId, userId)
              .catch(() => {});

            const raw = speakerEntries[userId];
            if (!raw) return;
            try {
              const speaker =
                parseRedisJson<
                  RoomMediaState["speakers"][string]
                >(raw);
              if (speaker.sessionId) {
                await provider
                  .closeSession(speaker.sessionId)
                  .catch(() => {});
              }
            } catch {
              // Malformed entry — already removed from the hash above.
            }
          }),
        );
      }

      const viewers:
        RoomMediaState["viewers"] =
        {};

      /*
       * Viewer collection and viewer details deliberately use
       * different Redis keys. The collection key is a SET of IDs;
       * each per-viewer key is a HASH containing that viewer's state.
       */
      const viewerIds =
        await normalizeViewerCollectionKey(
          roomId,
        );

      for (const userId of viewerIds) {
        const value =
          await redis.hgetall(
            mediaKeys.viewer(
              roomId,
              userId,
            ),
          );

        if (Object.keys(value).length === 0) {
          continue;
        }

        viewers[userId] = {
          userId:
            value.userId ??
            userId,

          sessionId:
            value.sessionId ??
            "",

          generation:
            Number(
              value.generation ??
                0,
            ),

          status:
            value.status as
              NonNullable<
                RoomMediaState["viewers"][string]
              >["status"],

          joinedAt:
            Number(
              value.joinedAt ??
                0,
            ),

          lastHeartbeatAt:
            Number(
              value.lastHeartbeatAt ??
                0,
            ),

          lastSequence:
            Number(
              value.lastSequence ??
                0,
            ),
        };
      }

      const viewerCount =
        viewerIds.length;

      return {
        roomId,

        status:
          (raw.status as
            RoomMediaState["status"]) ??
          "idle",

        generation:
          Number(
            raw.generation ??
              0,
          ),

        sequence:
          Number(
            raw.sequence ??
              0,
          ),

        host,

        speakers,

        viewers,

        viewerCount,

        updatedAt:
          Number(
            raw.updatedAt ??
              now(),
          ),
      };
    },

    async initializeRoom(
      roomId: string,
    ): Promise<RoomMediaState> {
      const existing =
        await this.getRoomState(
          roomId,
        );

      if (
        existing.status !==
          "idle" &&
        existing.status !==
          "ended"
      ) {
        return existing;
      }

      const state =
        createEmptyRoomState(
          roomId,
        );

      await redis.hset(
        mediaKeys.media(
          roomId,
        ),
        {
          status:
            state.status,

          generation:
            String(
              state.generation,
            ),

          sequence:
            String(
              state.sequence,
            ),

          updatedAt:
            String(
              state.updatedAt,
            ),
        },
      );

      await redis.expire(
        mediaKeys.media(
          roomId,
        ),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );

      return state;
    },

    async setRoomStatus(
      roomId: string,
      status: RoomMediaState["status"],
    ): Promise<void> {
      await redis.hset(
        mediaKeys.media(
          roomId,
        ),
        {
          status,

          updatedAt:
            String(now()),
        },
      );

      await redis.expire(
        mediaKeys.media(
          roomId,
        ),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async incrementGeneration(
      roomId: string,
    ): Promise<number> {
      const generation =
        await redis.hincrby(
          mediaKeys.media(
            roomId,
          ),
          "generation",
          1,
        );

      await redis.hset(
        mediaKeys.media(
          roomId,
        ),
        {
          updatedAt:
            String(now()),
        },
      );

      await redis.expire(
        mediaKeys.media(
          roomId,
        ),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );

      return generation;
    },

    async getGeneration(
      roomId: string,
    ): Promise<number> {
      const value =
        await redis.hget(
          mediaKeys.media(
            roomId,
          ),
          "generation",
        );

      return Number(
        value ?? 0,
      );
    },

    async assertGeneration(
      roomId: string,
      expectedGeneration: number,
    ): Promise<void> {
      const current =
        await this.getGeneration(
          roomId,
        );

      if (
        current !==
        expectedGeneration
      ) {
        throw new MediaGenerationMismatchError(
          current,
          expectedGeneration,
        );
      }
    },

    async saveSession(
      session: MediaSession,
    ): Promise<void> {
      const key =
        mediaKeys.media(
          session.roomId,
        );

      await redis.hset(
        key,
        {
          status:
            session.status,

          generation:
            String(
              session.generation,
            ),

          updatedAt:
            String(now()),
        },
      );

      if (
        session.role ===
        "host"
      ) {
        await redis.hset(
          key,
          {
            host:
              JSON.stringify(
                session,
              ),
          },
        );
      }

      await redis.expire(
        key,
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async saveHostSession(
      session: MediaSession,
      videoTrackName: string,
      audioTrackName: string,
    ): Promise<void> {
      if (
        session.role !==
        "host"
      ) {
        throw new MediaStateConflictError(
          "Only host sessions can be stored as host media state",
        );
      }

      const key =
        mediaKeys.media(
          session.roomId,
        );

      await redis.hset(
        key,
        {
          status:
            session.status,

          generation:
            String(
              session.generation,
            ),

          host:
            JSON.stringify({
              userId:
                session.userId,

              sessionId:
                session.sessionId,

              videoTrackName,

              audioTrackName,

              generation:
                session.generation,

              status:
                session.status,

              connectedAt:
                session.createdAt,

              lastHeartbeatAt:
                session.lastHeartbeatAt,
            }),

          updatedAt:
            String(now()),
        },
      );

      await redis.expire(
        key,
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async saveSpeakerSession(
      session: MediaSession,
      audioTrackName: string,
      videoTrackName?: string,
    ): Promise<void> {
      if (
        session.role !==
        "speaker"
      ) {
        throw new MediaStateConflictError(
          "Only speaker sessions can be stored as speaker media state",
        );
      }

      await redis.hset(
        mediaKeys.speakers(
          session.roomId,
        ),
        session.userId,
        JSON.stringify({
          userId:
            session.userId,

          sessionId:
            session.sessionId,

          audioTrackName,

          videoTrackName,

          hasVideo:
            Boolean(
              videoTrackName,
            ),

          generation:
            session.generation,

          status:
            session.status,

          joinedAt:
            session.createdAt,

          lastHeartbeatAt:
            session.lastHeartbeatAt,
        }),
      );

      await redis.expire(
        mediaKeys.speakers(
          session.roomId,
        ),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async removeSpeakerSession(
      roomId: string,
      userId: string,
    ): Promise<void> {
      await redis.hdel(
        mediaKeys.speakers(
          roomId,
        ),
        userId,
      );

      await redis.del(
        mediaKeys.lease(
          roomId,
          userId,
        ),
      );
    },
    async saveViewerSession(
      session: MediaSession,
    ): Promise<void> {
      if (
        session.role !==
        "viewer"
      ) {
        throw new MediaStateConflictError(
          "Only viewer sessions can be stored as viewer media state",
        );
      }

      const collectionKey =
        mediaKeys.viewers(
          session.roomId,
        );

      const participantKey =
        mediaKeys.viewer(
          session.roomId,
          session.userId,
        );

      await redis.sadd(
        collectionKey,
        session.userId,
      );

      await redis.hset(
        participantKey,
        {
          userId:
            session.userId,

          sessionId:
            session.sessionId,

          generation:
            String(
              session.generation,
            ),

          status:
            session.status,

          joinedAt:
            String(
              session.createdAt,
            ),

          lastHeartbeatAt:
            String(
              session.lastHeartbeatAt,
            ),

          lastSequence:
            "0",
        },
      );

      await redis.expire(
        collectionKey,
        mediaConfig.redis
          .roomStateTtlSeconds,
      );

      await redis.expire(
        participantKey,
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async removeHostSession(
    roomId: string,
  ): Promise<void> {
    const state = await this.getRoomState(roomId);

    if (state.host?.sessionId) {
      await redis.del(
        mediaKeys.lease(
          roomId,
          state.host.userId,
        ),
      );
    }

    await redis.hdel(
      mediaKeys.media(roomId),
      "host",
    );

    await redis.hset(
      mediaKeys.media(roomId),
      {
        updatedAt: String(now()),
      },
    );

    await redis.expire(
      mediaKeys.media(roomId),
      mediaConfig.redis.roomStateTtlSeconds,
    );
  },
    async clearParticipants(
      roomId: string,
    ): Promise<void> {
      await redis.hdel(
        mediaKeys.media(
          roomId,
        ),
        "host",
      );

      const speakerIds =
        await redis.hkeys(
          mediaKeys.speakers(
            roomId,
          ),
        );

      const viewerIds =
        await redis.smembers(
          mediaKeys.viewers(
            roomId,
          ),
        );

      const participantKeys = [
        ...speakerIds.map((userId: string) =>
          mediaKeys.speaker(
            roomId,
            userId,
          ),
        ),
        ...viewerIds.map((userId: string) =>
          mediaKeys.viewer(
            roomId,
            userId,
          ),
        ),
      ];

      if (participantKeys.length > 0) {
        await redis.del(
          participantKeys,
        );
      }

      await redis.del([
        mediaKeys.speakers(
          roomId,
        ),
        mediaKeys.viewers(
          roomId,
        ),
      ]);
    },

    async removeViewerSession(
      roomId: string,
      userId: string,
    ): Promise<void> {
      await redis.srem(
        mediaKeys.viewers(
          roomId,
        ),
        userId,
      );

      await redis.del(
        mediaKeys.viewer(
          roomId,
          userId,
        ),
      );

      await redis.del(
        mediaKeys.lease(
          roomId,
          userId,
        ),
      );
    },

    async nextSequence(
      roomId: string,
    ): Promise<number> {
      const sequence =
        await redis.incr(
          mediaKeys.sequence(
            roomId,
          ),
        );

      await redis.expire(
        mediaKeys.sequence(
          roomId,
        ),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );

      await redis.hset(
        mediaKeys.media(
          roomId,
        ),
        {
          sequence:
            String(sequence),

          updatedAt:
            String(now()),
        },
      );

      return sequence;
    },

    async createEvent<TPayload>(
      roomId: string,
      generation: number,
      type: MediaEventType,
      payload: TPayload,
    ): Promise<
      MediaEvent<TPayload>
    > {
      const currentGeneration =
        await this.getGeneration(
          roomId,
        );

      if (
        currentGeneration !==
        generation
      ) {
        throw new MediaGenerationMismatchError(
          currentGeneration,
          generation,
        );
      }

      const sequence =
        await this.nextSequence(
          roomId,
        );

      return createMediaEvent({
        roomId,

        sequence,

        generation,

        type,

        payload,
      });
    },

    /*
     * Shared heartbeat implementation.
     *
     * The lease is the actual liveness mechanism.
     * Participant media state also receives the
     * heartbeat timestamp so room state remains
     * observable/debuggable.
     */
    async heartbeat(
      roomId: string,
      userId: string,
      role: MediaParticipantRole,
      sessionId: string,
      generation: number,
    ): Promise<void> {
      const currentGeneration =
        await this.getGeneration(
          roomId,
        );

      if (
        currentGeneration !==
        generation
      ) {
        throw new MediaGenerationMismatchError(
          currentGeneration,
          generation,
        );
      }

      const state =
        await this.getRoomState(
          roomId,
        );

      const timestamp =
        now();

      /*
       * Verify that this heartbeat belongs to
       * the currently active media session.
       */
      if (
        role === "host"
      ) {
        if (
          !state.host ||
          state.host.userId !==
            userId ||
          state.host.sessionId !==
            sessionId ||
          state.host.generation !==
            generation
        ) {
          throw new MediaStateConflictError(
            "Host heartbeat does not match the active media session",
          );
        }
      }

      if (
        role === "speaker"
      ) {
        const speaker =
          state.speakers[
            userId
          ];

        if (
          !speaker ||
          speaker.userId !==
            userId ||
          speaker.sessionId !==
            sessionId ||
          speaker.generation !==
            generation
        ) {
          throw new MediaStateConflictError(
            "Speaker heartbeat does not match the active media session",
          );
        }
      }
      if (
        role === "viewer"
      ) {
        const viewer =
          state.viewers[
            userId
          ];

        if (viewer) {
          await redis.hset(
            mediaKeys.viewer(
              roomId,
              userId,
            ),
            {
              userId:
                viewer.userId,

              sessionId:
                viewer.sessionId,

              generation:
                String(
                  viewer.generation,
                ),

              status:
                viewer.status,

              joinedAt:
                String(
                  viewer.joinedAt,
                ),

              lastHeartbeatAt:
                String(
                  timestamp,
                ),

              lastSequence:
                String(
                  viewer.lastSequence ??
                    0,
                ),
            },
          );

          await redis.expire(
            mediaKeys.viewer(
              roomId,
              userId,
            ),
            mediaConfig.redis
              .roomStateTtlSeconds,
          );

          await redis.expire(
            mediaKeys.viewers(
              roomId,
            ),
            mediaConfig.redis
              .roomStateTtlSeconds,
          );
        }
      }
    },

    /*
     * Host heartbeat wrapper.
     *
     * room-media.service.ts calls this method after
     * validating that the request belongs to the host.
     */
    async touchHostSession(
      roomId: string,
      sessionId: string,
    ): Promise<void> {
      const state =
        await this.getRoomState(
          roomId,
        );

      if (!state.host) {
        throw new MediaStateConflictError(
          "Host media session does not exist",
        );
      }

      await this.heartbeat(
        roomId,
        state.host.userId,
        "host",
        sessionId,
        state.host.generation,
      );
    },

    /*
     * Speaker heartbeat wrapper.
     */
    async touchSpeakerSession(
      roomId: string,
      userId: string,
      sessionId: string,
    ): Promise<void> {
      const state =
        await this.getRoomState(
          roomId,
        );

      const speaker =
        state.speakers[
          userId
        ];

      if (!speaker) {
        throw new MediaStateConflictError(
          "Speaker media session does not exist",
        );
      }

      await this.heartbeat(
        roomId,
        userId,
        "speaker",
        sessionId,
        speaker.generation,
      );
    },

    /*
     * Viewer heartbeat wrapper.
     */
    async touchViewerSession(
      roomId: string,
      userId: string,
      sessionId: string,
    ): Promise<void> {
      const state =
        await this.getRoomState(
          roomId,
        );

      const viewer =
        state.viewers[
          userId
        ];

      if (!viewer) {
        throw new MediaStateConflictError(
          "Viewer media session does not exist",
        );
      }

      await this.heartbeat(
        roomId,
        userId,
        "viewer",
        sessionId,
        viewer.generation,
      );
    },

    async getProvider(): Promise<MediaProvider> {
      return provider;
    },

    async createIdempotencyKey(): Promise<string> {
      return randomUUID();
    },
  };
}