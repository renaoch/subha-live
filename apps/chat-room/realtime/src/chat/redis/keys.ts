/**
 * All Redis key names used by the Chat service live here so nothing is
 * scattered across the codebase as string literals.
 */
export const redisKeys = {
  /** Hot-history bucket stream for a room covering one ~N-minute window. */
  bucket: (roomId: string, bucketStart: number) => `chat:room:${roomId}:bucket:${bucketStart}`,

  /** Lock used to protect a single bucket lookup from a cache stampede. */
  historyLock: (roomId: string, bucketStart: number) => `chat:history:lock:${roomId}:${bucketStart}`,

  /** Pub/sub notification fired when a stampede lock owner finishes populating a bucket. */
  historyLockNotify: (roomId: string, bucketStart: number) => `chat:history:lock:notify:${roomId}:${bucketStart}`,

  /** Short-lived cache of a Postgres history-fallback result, used to protect against cache stampedes. */
  historyResultCache: (roomId: string, bucketStart: number, cursor: string, limit: number) =>
    `chat:history:result:${roomId}:${bucketStart}:${cursor}:${limit}`,

  /** Cached Core API authorization/profile resolution for a user in a room. */
  authCache: (userId: string, roomId: string) => `chat:auth:${userId}:${roomId}`,

  /** Prefix used to sweep all authorization cache entries for a user. */
  authCacheUserPrefix: (userId: string) => `chat:auth:${userId}:*`,

  /** Message rate limit bucket for a user. */
  messageRate: (userId: string, roomId: string) => `chat:rate:message:${userId}:${roomId}`,

  /** Connection-attempt rate limit for a user. */
  connectionRate: (userId: string) => `chat:rate:connection:${userId}`,

  /** History-request rate limit for a user. */
  historyRate: (userId: string) => `chat:rate:history:${userId}`,

  /** Realtime fanout channel for a room. */
  pubsubRoom: (roomId: string) => `pubsub:room:${roomId}:chat`,
  pubsubRoomPattern: 'pubsub:room:*:chat',

  /** Asynchronous durability pipeline: chat messages awaiting Postgres persistence. */
  persistenceStream: 'chat:persistence:stream',
  persistenceConsumerGroup: 'chat:persistence:workers',
} as const
