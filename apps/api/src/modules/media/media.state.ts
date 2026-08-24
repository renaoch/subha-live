import {
  MEDIA_ROOM_RESOURCES,
} from "./media.constants";

const MEDIA_PREFIX = "media";

function roomKey(
  roomId: string,
  resource: string,
): string {
  return `${MEDIA_PREFIX}:room:${roomId}:${resource}`;
}

export const mediaKeys = {
  media(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.MEDIA,
    );
  },

  speakers(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.SPEAKERS,
    );
  },

  viewers(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.VIEWERS,
    );
  },

  leases(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.LEASES,
    );
  },

  sequence(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.SEQUENCE,
    );
  },

  idempotency(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.IDEMPOTENCY,
    );
  },

  locks(roomId: string): string {
    return roomKey(
      roomId,
      MEDIA_ROOM_RESOURCES.LOCKS,
    );
  },

  speaker(
    roomId: string,
    userId: string,
  ): string {
    return `${mediaKeys.speakers(roomId)}:${userId}`;
  },

  viewer(
    roomId: string,
    userId: string,
  ): string {
    return `${mediaKeys.viewers(roomId)}:${userId}`;
  },

  lease(
    roomId: string,
    participantId: string,
  ): string {
    return `${mediaKeys.leases(roomId)}:${participantId}`;
  },

  idempotencyRecord(
    roomId: string,
    idempotencyKey: string,
  ): string {
    return `${mediaKeys.idempotency(roomId)}:${idempotencyKey}`;
  },

  lock(
    roomId: string,
    lockName: string,
  ): string {
    return `${mediaKeys.locks(roomId)}:${lockName}`;
  },
};