import type Redis from 'ioredis'
import { redisKeys } from './keys.js'
import type { ChatMessage } from '../chat.types.js'

export type StreamEntry = { entryId: string; message: ChatMessage }

/** Append a canonical chat message to the durability stream. */
export async function appendToPersistenceStream(redis: Redis, message: ChatMessage, maxLen: number): Promise<void> {
  await redis.xadd(redisKeys.persistenceStream, 'MAXLEN', '~', maxLen, '*', 'payload', JSON.stringify(message))
}

/**
 * Ensure the consumer group exists. Uses MKSTREAM so the group (and stream)
 * are created if this is the very first boot. Safe to call on every worker
 * start; BUSYGROUP is swallowed.
 */
export async function ensureConsumerGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup('CREATE', redisKeys.persistenceStream, redisKeys.persistenceConsumerGroup, '0', 'MKSTREAM')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('BUSYGROUP')) throw error
  }
}

/**
 * Read a batch of entries for this consumer via XREADGROUP. Unlike a
 * manually tracked `lastId` + XREAD, this gives at-least-once delivery with
 * per-consumer pending tracking: entries are only removed from the pending
 * list once explicitly XACKed after a successful Postgres commit, so a
 * worker crash mid-batch does not lose messages.
 */
export async function readPersistenceBatch(
  redis: Redis,
  consumerName: string,
  count: number,
  blockMs: number
): Promise<StreamEntry[]> {
  const result = await redis.xreadgroup(
    'GROUP',
    redisKeys.persistenceConsumerGroup,
    consumerName,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    redisKeys.persistenceStream,
    '>'
  )
  if (!result) return []
  const [, entries] = result[0] as [string, [string, string[]][]]
  return entries.map(([entryId, fields]) => ({ entryId, message: JSON.parse(fields[1]) as ChatMessage }))
}

/** Reclaim entries that were delivered to a consumer but never acknowledged (e.g. that consumer crashed). */
export async function claimStalePendingEntries(
  redis: Redis,
  consumerName: string,
  minIdleTimeMs: number,
  count: number
): Promise<StreamEntry[]> {
  const result = await redis.xautoclaim(
    redisKeys.persistenceStream,
    redisKeys.persistenceConsumerGroup,
    consumerName,
    minIdleTimeMs,
    '0',
    'COUNT',
    count
  )
  // ioredis returns [nextCursor, entries, deletedIds]
  const entries = (result[1] as [string, string[]][]) ?? []
  return entries.map(([entryId, fields]) => ({ entryId, message: JSON.parse(fields[1]) as ChatMessage }))
}

export async function acknowledge(redis: Redis, entryIds: string[]): Promise<void> {
  if (!entryIds.length) return
  await redis.xack(redisKeys.persistenceStream, redisKeys.persistenceConsumerGroup, ...entryIds)
}

/**
 * Safely trim the stream so it never removes an entry that some consumer
 * still has pending (i.e. not yet XACKed). We look up the oldest pending
 * entry ID across the whole consumer group via XPENDING and only trim
 * strictly before it. If there is no pending backlog, we fall back to an
 * approximate MAXLEN trim as a memory safety net.
 *
 * This is what makes the retention strategy safe against MAXLEN ~ N deleting
 * messages the persistence worker has not processed yet.
 */
export async function trimSafely(redis: Redis, approximateMaxLen: number): Promise<void> {
  const summary = (await redis.xpending(redisKeys.persistenceStream, redisKeys.persistenceConsumerGroup)) as
    | [number, string | null, string | null, unknown]
    | null
  const oldestPendingId = summary?.[1]
  if (oldestPendingId) {
    await redis.xtrim(redisKeys.persistenceStream, 'MINID', oldestPendingId)
    return
  }
  await redis.xtrim(redisKeys.persistenceStream, 'MAXLEN', '~', approximateMaxLen)
}
