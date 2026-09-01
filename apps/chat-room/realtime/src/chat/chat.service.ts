import type Redis from 'ioredis'
import type { Config } from '../infrastructure/config.js'
import { logger } from '../infrastructure/logger.js'
import type { AuthorizationCache } from './chat.types.js'
import { ChatError, messageId, type AuthorizedContext, type ChatMessage, type Cursor } from './chat.types.js'
import { ChatRepository } from './chat.repository.js'
import { addToBucket, bucketSizeMsFromMinutes, bucketStart, isWithinHotWindow, readHotRange } from './redis/buckets.js'
import { publishMessage } from './redis/pubsub.js'
import { appendToPersistenceStream } from './redis/stream.js'
import { allowTokenBucket } from './redis/rateLimit.js'
import { redisKeys } from './redis/keys.js'
import { withSingleFlight } from './redis/lock.js'
import { metrics } from '../infrastructure/metrics.js'

export type HistoryPage = { messages: ChatMessage[]; nextCursor: string | null }

export class ChatService {
  private readonly bucketSizeMs: number

  constructor(
    private readonly redis: Redis,
    private readonly publisher: Redis,
    private readonly repository: ChatRepository,
    private readonly authorizationCache: AuthorizationCache,
    private readonly config: Config
  ) {
    this.bucketSizeMs = bucketSizeMsFromMinutes(config.CHAT_BUCKET_SIZE_MINUTES)
  }

  /** Authenticate has already happened (Supabase JWT). This resolves room authorization for that identity. */
  async authorizeRoom(userId: string, roomId: string, accessToken: string): Promise<AuthorizedContext> {
    const authorization = await this.authorizationCache.resolve(userId, roomId, accessToken)
    if (!authorization.canAccess) {
      throw new ChatError('ROOM_FORBIDDEN', 'Room access denied')
    }
    return { userId, ...authorization }
  }

  async allowMessageRate(userId: string, roomId: string): Promise<boolean> {
    return allowTokenBucket(
      this.redis,
      redisKeys.messageRate(userId, roomId),
      this.config.CHAT_RATE_LIMIT_MESSAGES,
      this.config.CHAT_RATE_LIMIT_MESSAGES / this.config.CHAT_RATE_LIMIT_WINDOW_SECONDS
    )
  }

  async allowConnectionRate(userId: string): Promise<boolean> {
    return allowTokenBucket(
      this.redis,
      redisKeys.connectionRate(userId),
      this.config.CHAT_CONNECTION_RATE_LIMIT,
      this.config.CHAT_CONNECTION_RATE_LIMIT / this.config.CHAT_CONNECTION_RATE_LIMIT_WINDOW_SECONDS
    )
  }

  async allowHistoryRate(userId: string): Promise<boolean> {
    return allowTokenBucket(
      this.redis,
      redisKeys.historyRate(userId),
      this.config.CHAT_HISTORY_RATE_LIMIT,
      this.config.CHAT_HISTORY_RATE_LIMIT / this.config.CHAT_HISTORY_RATE_LIMIT_WINDOW_SECONDS
    )
  }

  /**
   * Build the canonical message and fan it out through the full pipeline:
   * hot-history bucket, durability stream, and pub/sub - all using the exact
   * same object, so no layer invents its own id/timestamp.
   */
  async submitMessage(context: AuthorizedContext, roomId: string, text: string): Promise<ChatMessage> {
    if (context.isMuted) throw new ChatError('CHAT_MUTED', 'You are muted in this room')
    if (context.canChat === false) throw new ChatError('CHAT_FRIENDS_ONLY', 'Only friends of the host can chat in this room')

    const message: ChatMessage = {
      id: messageId(),
      roomId,
      userId: context.userId,
      username: context.username,
      avatar: context.avatar,
      message: text,
      createdAt: Date.now(),
    }

    await Promise.all([
      addToBucket(this.redis, roomId, message, this.bucketSizeMs, this.config.CHAT_REDIS_RETENTION_MINUTES * 60),
      appendToPersistenceStream(this.redis, message, this.config.CHAT_PERSISTENCE_STREAM_MAXLEN),
    ])
    await publishMessage(this.publisher, message)
    metrics.messagesTotal.inc()
    metrics.messageProcessingLatencyMs.record(Date.now() - message.createdAt)
    return message
  }

  /**
   * History lookup: hot Redis buckets first, Postgres only for ranges outside
   * the hot window or on a genuine cache miss - and even then, protected by
   * single-flight so a stampede of identical requests results in one query.
   */
  async getHistory(roomId: string, before: Cursor | undefined, limit: number): Promise<HistoryPage> {
    metrics.historyRequestsTotal.inc()
    const now = Date.now()
    const endTime = before ? before.createdAt - 1 : now
    const retentionMinutes = this.config.CHAT_REDIS_RETENTION_MINUTES

    let messages: ChatMessage[]
    if (isWithinHotWindow(endTime, now, retentionMinutes)) {
      messages = await this.hotOrSingleFlight(roomId, endTime, limit, before)
    } else {
      messages = await this.repository.history(roomId, before, limit)
    }

    const page = messages.slice(0, limit)
    const last = page.at(-1)
    return { messages: page, nextCursor: last ? makeCursor({ createdAt: last.createdAt, id: last.id }) : null }
  }

  private async hotOrSingleFlight(roomId: string, endTime: number, limit: number, before: Cursor | undefined): Promise<ChatMessage[]> {
    const start = bucketStart(endTime, this.bucketSizeMs)
    const startOfWindow = start - this.bucketSizeMs * 2 // read a little extra to have enough rows before trimming to `limit`

    // Fast path: Redis reads are naturally safe under concurrency, so if the
    // hot buckets already have data for this range there is no need for a
    // lock at all - just read and return.
    const hot = await readHotRange(this.redis, roomId, startOfWindow, endTime, this.bucketSizeMs)
    const filtered = applyCursor(hot, before)
    if (filtered.length) {
      metrics.redisCacheHits.inc()
      return filtered.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, limit)
    }
    metrics.redisCacheMisses.inc()
    metrics.historyCacheMisses.inc()

    // Miss: this is the path that could stampede Postgres under hundreds of
    // simultaneous identical requests, so it is protected by single-flight
    // against a short-lived Redis-backed result cache (not the hot bucket
    // itself, which only Postgres-persisted, out-of-band writers should
    // populate).
    const cursorKey = before ? `${before.createdAt}:${before.id}` : 'latest'
    const resultCacheKey = redisKeys.historyResultCache(roomId, start, cursorKey, limit)

    const result = await withSingleFlight<ChatMessage[]>({
      redis: this.redis,
      lockKey: redisKeys.historyLock(roomId, start),
      lockTtlSeconds: this.config.CHAT_HISTORY_LOCK_TTL_SECONDS,
      readCache: async () => {
        const cached = await this.redis.get(resultCacheKey)
        return cached ? (JSON.parse(cached) as ChatMessage[]) : null
      },
      compute: async () => {
        logger.info({ roomId, start }, 'chat history cache miss, falling back to postgres')
        return this.repository.history(roomId, before, limit)
      },
      writeCache: async (value) => {
        await this.redis.set(resultCacheKey, JSON.stringify(value), 'EX', this.config.CHAT_HISTORY_LOCK_TTL_SECONDS)
      },
    })

    return result.value
  }
}

function applyCursor(messages: ChatMessage[], before: Cursor | undefined): ChatMessage[] {
  if (!before) return messages
  return messages.filter((m) => m.createdAt < before.createdAt || (m.createdAt === before.createdAt && m.id < before.id))
}

function makeCursor(value: Cursor): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}