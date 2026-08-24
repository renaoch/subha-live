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
    viewerCount: 0,
    updatedAt: now(),
  };
}

export function createMediaService(
  dependencies: MediaServiceDependencies,
) {
  const { provider } = dependencies;

  return {
    async getRoomState(
      roomId: string,
    ): Promise<RoomMediaState> {
      const raw = await redis.hGetAll(
        mediaKeys.media(roomId),
      );

      if (
        !raw ||
        Object.keys(raw).length === 0
      ) {
        return createEmptyRoomState(
          roomId,
        );
      }

      let host:
        | RoomMediaState["host"]
        | null = null;

      if (raw.host) {
        host = JSON.parse(raw.host);
      }

      const speakers: RoomMediaState["speakers"] =
        {};

      const speakerEntries =
        await redis.hGetAll(
          mediaKeys.speakers(roomId),
        );

      for (const [
        userId,
        value,
      ] of Object.entries(
        speakerEntries,
      )) {
        speakers[userId] = JSON.parse(
          value,
        );
      }

      const viewerCount =
        await redis.sCard(
          mediaKeys.viewers(roomId),
        );

      return {
        roomId,
        status:
          (raw.status as RoomMediaState["status"]) ??
          "idle",
        generation: Number(
          raw.generation ?? 0,
        ),
        sequence: Number(
          raw.sequence ?? 0,
        ),
        host,
        speakers,
        viewerCount,
        updatedAt: Number(
          raw.updatedAt ?? now(),
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
        existing.status !== "idle" &&
        existing.status !== "ended"
      ) {
        return existing;
      }

      const state =
        createEmptyRoomState(
          roomId,
        );

      await redis.hSet(
        mediaKeys.media(roomId),
        {
          status: state.status,
          generation: String(
            state.generation,
          ),
          sequence: String(
            state.sequence,
          ),
          updatedAt: String(
            state.updatedAt,
          ),
        },
      );

      await redis.expire(
        mediaKeys.media(roomId),
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
        mediaKeys.media(roomId),
        {
          status,
          updatedAt: String(
            now(),
          ),
        },
      );

      await redis.expire(
        mediaKeys.media(roomId),
        mediaConfig.redis
          .roomStateTtlSeconds,
      );
    },

    async incrementGeneration(
      roomId: string,
    ): Promise<number> {
      const generation =
        await redis.hIncrBy(
          mediaKeys.media(roomId),
          "generation",
          1,
        );

      await redis.hSet(
        mediaKeys.media(roomId),
        {
          updatedAt: String(
            now(),
          ),
        },
      );

      await redis.expire(
        mediaKeys.media(roomId),
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
          mediaKeys.media(roomId),
          "generation",
        );

      return Number(value ?? 0);
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
        current !== expectedGeneration
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
          status: session.status,
          generation: String(
            session.generation,
          ),
          updatedAt: String(
            now(),
          ),
        },
      );

      if (session.role === "host") {
        await redis.hSet(
          key,
          {
            host: JSON.stringify(
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

    async saveSpeakerSession(
      session: MediaSession,
      audioTrackName: string,
    ): Promise<void> {
      if (
        session.role !== "speaker"
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
          userId: session.userId,
          sessionId:
            session.sessionId,
          audioTrackName,
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
    },

    async saveViewerSession(
      session: MediaSession,
    ): Promise<void> {
      if (
        session.role !== "viewer"
      ) {
        throw new MediaStateConflictError(
          "Only viewer sessions can be stored as viewer media state",
        );
      }

      await redis.hSet(
        mediaKeys.viewers(
          session.roomId,
        ),
        session.userId,
        JSON.stringify({
          userId: session.userId,
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
        mediaKeys.media(roomId),
        {
          sequence: String(
            sequence,
          ),
          updatedAt: String(
            now(),
          ),
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

      const key =
        mediaKeys.lease(
          roomId,
          userId,
        );

      await redis.hSet(
        key,
        {
          participantId:
            userId,
          sessionId,
          role,
          generation: String(
            generation,
          ),
          lastHeartbeatAt:
            String(now()),
          expiresAt: String(
            now() +
              mediaConfig.heartbeat
                .timeoutMs,
          ),
        },
      );

      await redis.expire(
        key,
        Math.ceil(
          mediaConfig.heartbeat
            .timeoutMs / 1000,
        ),
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