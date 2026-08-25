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
        await redis.hGetAll(
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
        await redis.hGetAll(
          mediaKeys.speakers(
            roomId,
          ),
        );

      for (const [
        userId,
        value,
      ] of Object.entries(
        speakerEntries,
      )) {
        speakers[userId] =
          parseRedisJson(
            value,
          );
      }

      const viewers:
        RoomMediaState["viewers"] =
        {};

      const viewerEntries =
        await redis.hGetAll(
          mediaKeys.viewers(
            roomId,
          ),
        );

      for (const [
        userId,
        value,
      ] of Object.entries(
        viewerEntries,
      )) {
        viewers[userId] =
          parseRedisJson(value);
      }

      const viewerCount =
        await redis.sCard(
          mediaKeys.viewers(
            roomId,
          ),
        );

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

      await redis.hSet(
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
      await redis.hSet(
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
        await redis.hIncrBy(
          mediaKeys.media(
            roomId,
          ),
          "generation",
          1,
        );

      await redis.hSet(
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
        await redis.hGet(
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

      await redis.hSet(
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
        await redis.hSet(
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

      await redis.hSet(
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

      await redis.hSet(
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
      await redis.hDel(
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

      await redis.sAdd(
        mediaKeys.viewers(
          session.roomId,
        ),
        session.userId,
      );

      await redis.hSet(
        mediaKeys.viewers(
          session.roomId,
        ),
        session.userId,
        JSON.stringify({
          userId:
            session.userId,

          sessionId:
            session.sessionId,

          generation:
            session.generation,

          status:
            session.status,

          joinedAt:
            session.createdAt,

          lastHeartbeatAt:
            session.lastHeartbeatAt,

          lastSequence: 0,
        }),
      );

      await redis.expire(
        mediaKeys.viewers(
          session.roomId,
        ),
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

    await redis.hDel(
      mediaKeys.media(roomId),
      "host",
    );

    await redis.hSet(
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
      await redis.hDel(
        mediaKeys.media(
          roomId,
        ),
        "host",
      );

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
      await redis.hDel(
        mediaKeys.viewers(
          roomId,
        ),
        userId,
      );

      await redis.sRem(
        mediaKeys.viewers(
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

      await redis.hSet(
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

        if (
          !viewer ||
          viewer.userId !==
            userId ||
          viewer.sessionId !==
            sessionId ||
          viewer.generation !==
            generation
        ) {
          throw new MediaStateConflictError(
            "Viewer heartbeat does not match the active media session",
          );
        }
      }

      /*
       * Lease key:
       *
       * This is what allows stale-session cleanup to
       * determine that a participant disappeared.
       */
      const leaseKey =
        mediaKeys.lease(
          roomId,
          userId,
        );

      const expiresAt =
        timestamp +
        mediaConfig.heartbeat
          .timeoutMs;

      await redis.hSet(
        leaseKey,
        {
          participantId:
            userId,

          sessionId,

          role,

          generation:
            String(generation),

          lastHeartbeatAt:
            String(timestamp),

          expiresAt:
            String(expiresAt),
        },
      );

      await redis.expire(
        leaseKey,
        Math.ceil(
          mediaConfig.heartbeat
            .timeoutMs /
            1000,
        ),
      );

      /*
       * Keep the media participant state in sync
       * with the lease.
       */
      if (
        role === "host"
      ) {
        await redis.hSet(
          mediaKeys.media(
            roomId,
          ),
          {
            host:
              JSON.stringify({
                ...state.host,
                lastHeartbeatAt:
                  timestamp,
              }),

            updatedAt:
              String(timestamp),
          },
        );

        await redis.expire(
          mediaKeys.media(
            roomId,
          ),
          mediaConfig.redis
            .roomStateTtlSeconds,
        );
      }

      if (
        role === "speaker"
      ) {
        const speaker =
          state.speakers[
            userId
          ];

        if (speaker) {
          await redis.hSet(
            mediaKeys.speakers(
              roomId,
            ),
            userId,
            JSON.stringify({
              ...speaker,
              lastHeartbeatAt:
                timestamp,
            }),
          );

          await redis.expire(
            mediaKeys.speakers(
              roomId,
            ),
            mediaConfig.redis
              .roomStateTtlSeconds,
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
          await redis.hSet(
            mediaKeys.viewers(
              roomId,
            ),
            userId,
            JSON.stringify({
              ...viewer,
              lastHeartbeatAt:
                timestamp,
            }),
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