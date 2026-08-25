import { redis } from "../../lib/redis";

const ROOM_STATE_TTL_SECONDS = 60 * 60 * 24;
const DEFAULT_AUDIO_REQUEST_LIMIT = 50;
const DEFAULT_GUEST_VIDEO_LIMIT = 1;

const ADD_SPEAKER_SCRIPT = `
  local speakersKey = KEYS[1]
  local userId = ARGV[1]
  local maxSlots = tonumber(ARGV[2])
  local ttl = tonumber(ARGV[3])

  -- User is already a speaker, so there is nothing to add.
  if redis.call("SISMEMBER", speakersKey, userId) == 1 then
    return 2
  end

  -- Check the limit and add the speaker in the same operation.
  local currentCount = redis.call("SCARD", speakersKey)

  if currentCount >= maxSlots then
    return 0
  end

  redis.call("SADD", speakersKey, userId)
  redis.call("EXPIRE", speakersKey, ttl)

  return 1
`;

const ADD_VIDEO_SPEAKER_SCRIPT = `
  local videoKey = KEYS[1]
  local speakersKey = KEYS[2]
  local userId = ARGV[1]
  local maxVideoSlots = tonumber(ARGV[2])
  local ttl = tonumber(ARGV[3])

  if redis.call("SISMEMBER", speakersKey, userId) == 0 then
    return -1
  end

  if redis.call("SISMEMBER", videoKey, userId) == 1 then
    return 2
  end

  if redis.call("SCARD", videoKey) >= maxVideoSlots then
    return 0
  end

  redis.call("SADD", videoKey, userId)
  redis.call("EXPIRE", videoKey, ttl)
  return 1
`;

function roomKey(roomId: string, resource: string): string {
  return `room:${roomId}:${resource}`;
}

export const roomState = {
  // Room state is temporary and should not remain in Redis indefinitely.
  async setState(
    roomId: string,
    state: Record<string, string>,
  ): Promise<void> {
    const key = roomKey(roomId, "state");

    // Keep the state update and TTL together.
    const multi = redis.multi();
    multi.hSet(key, state);
    multi.expire(key, ROOM_STATE_TTL_SECONDS);
    await multi.exec();
  },

  async getState(roomId: string): Promise<Record<string, string>> {
    return redis.hGetAll(roomKey(roomId, "state"));
  },

  async deleteState(roomId: string): Promise<void> {
    await redis.del(roomKey(roomId, "state"));
  },

  // Viewers are stored in a set so duplicate joins do not create duplicates.
  async addViewer(roomId: string, userId: string): Promise<void> {
    const key = roomKey(roomId, "viewers");

    const multi = redis.multi();
    multi.sAdd(key, userId);
    multi.expire(key, ROOM_STATE_TTL_SECONDS);
    await multi.exec();
  },

  async removeViewer(roomId: string, userId: string): Promise<void> {
    await redis.sRem(roomKey(roomId, "viewers"), userId);
  },

  async isViewer(roomId: string, userId: string): Promise<boolean> {
    const result = await redis.sIsMember(
      roomKey(roomId, "viewers"),
      userId,
    );

    return result === 1;
  },

  async getViewerCount(roomId: string): Promise<number> {
    return redis.sCard(roomKey(roomId, "viewers"));
  },

  // Speaker slots are limited, so capacity is checked atomically in Redis.
  async addSpeaker(
    roomId: string,
    userId: string,
    maxSlots: number,
  ): Promise<boolean> {
    if (maxSlots <= 0) {
      return false;
    }

    const result = await redis.eval(ADD_SPEAKER_SCRIPT, {
      keys: [roomKey(roomId, "speakers")],
      arguments: [
        userId,
        String(maxSlots),
        String(ROOM_STATE_TTL_SECONDS),
      ],
    });

    // 1 = added, 2 = already a speaker, 0 = capacity reached.
    return result === 1;
  },

  async addVideoSpeaker(
    roomId: string,
    userId: string,
    maxSlots: number = DEFAULT_GUEST_VIDEO_LIMIT,
  ): Promise<boolean> {
    if (maxSlots <= 0) return false;

    const result = await redis.eval(ADD_VIDEO_SPEAKER_SCRIPT, {
      keys: [
        roomKey(roomId, "video-speakers"),
        roomKey(roomId, "speakers"),
      ],
      arguments: [
        userId,
        String(maxSlots),
        String(ROOM_STATE_TTL_SECONDS),
      ],
    });

    return result === 1;
  },

  async removeVideoSpeaker(roomId: string, userId: string): Promise<void> {
    await redis.sRem(roomKey(roomId, "video-speakers"), userId);
  },

  async isVideoSpeaker(roomId: string, userId: string): Promise<boolean> {
    return (await redis.sIsMember(
      roomKey(roomId, "video-speakers"),
      userId,
    )) === 1;
  },

  async getVideoSpeaker(roomId: string): Promise<string | null> {
    const users = await redis.sMembers(roomKey(roomId, "video-speakers"));
    return users[0] ?? null;
  },

  async removeSpeaker(roomId: string, userId: string): Promise<void> {
    await redis.sRem(
      roomKey(roomId, "speakers"),
      userId,
    );
  },

  async isSpeaker(roomId: string, userId: string): Promise<boolean> {
    const result = await redis.sIsMember(
      roomKey(roomId, "speakers"),
      userId,
    );

    return result === 1;
  },

  async getSpeakers(roomId: string): Promise<string[]> {
    return redis.sMembers(
      roomKey(roomId, "speakers"),
    );
  },

  async getSpeakerCount(roomId: string): Promise<number> {
    return redis.sCard(
      roomKey(roomId, "speakers"),
    );
  },

  // Requests are kept in timestamp order so the host can process them FIFO.
  async addAudioRequest(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const key = roomKey(roomId, "requests");

    const multi = redis.multi();
    multi.zAdd(key, {
      score: Date.now(),
      value: userId,
    });
    multi.expire(key, ROOM_STATE_TTL_SECONDS);
    await multi.exec();
  },

  async removeAudioRequest(
    roomId: string,
    userId: string,
  ): Promise<void> {
    await redis.zRem(
      roomKey(roomId, "requests"),
      userId,
    );
  },

  async hasAudioRequest(
    roomId: string,
    userId: string,
  ): Promise<boolean> {
    const score = await redis.zScore(
      roomKey(roomId, "requests"),
      userId,
    );

    return score !== null;
  },

  async getAudioRequests(
    roomId: string,
    limit: number = DEFAULT_AUDIO_REQUEST_LIMIT,
  ): Promise<string[]> {
    return redis.zRange(
      roomKey(roomId, "requests"),
      0,
      limit - 1,
    );
  },

  // Remove all temporary Redis state for a room.
  async clear(roomId: string): Promise<void> {
    await redis.del([
      roomKey(roomId, "state"),
      roomKey(roomId, "viewers"),
      roomKey(roomId, "speakers"),
      roomKey(roomId, "video-speakers"),
      roomKey(roomId, "requests"),
    ]);
  },
};