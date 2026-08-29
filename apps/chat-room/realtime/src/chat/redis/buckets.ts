import type Redis from 'ioredis'
import { redisKeys } from './keys.js'
import type { ChatMessage } from '../chat.types.js'

/**
 * Hot history is stored in ~5-minute buckets. Each bucket is a Redis Stream
 * (not a list written with RPUSH and read with MGET, which are incompatible
 * access patterns) so writes (XADD) and reads (XRANGE) use the same
 * consistent data structure. Buckets expire after the configured retention
 * window; Postgres remains the durable source of truth once a bucket expires.
 */

export function bucketStart(time: number, bucketSizeMs: number): number {
  return Math.floor(time / bucketSizeMs) * bucketSizeMs
}

export function bucketSizeMsFromMinutes(minutes: number): number {
  return minutes * 60_000
}

export async function addToBucket(
  redis: Redis,
  roomId: string,
  message: ChatMessage,
  bucketSizeMs: number,
  retentionSeconds: number
): Promise<void> {
  const start = bucketStart(message.createdAt, bucketSizeMs)
  const key = redisKeys.bucket(roomId, start)
  await redis.xadd(key, '*', 'payload', JSON.stringify(message))
  await redis.expire(key, retentionSeconds)
}

export async function readBucket(redis: Redis, roomId: string, bucketStartMs: number): Promise<ChatMessage[]> {
  const key = redisKeys.bucket(roomId, bucketStartMs)
  const entries = await redis.xrange(key, '-', '+')
  return entries.map(([, fields]) => JSON.parse(fields[1]) as ChatMessage)
}

/** Does the given bucket exist at all (as opposed to existing-but-empty vs never written/expired)? */
export async function bucketExists(redis: Redis, roomId: string, bucketStartMs: number): Promise<boolean> {
  const key = redisKeys.bucket(roomId, bucketStartMs)
  return (await redis.exists(key)) === 1
}

export function bucketsInRange(startTime: number, endTime: number, bucketSizeMs: number): number[] {
  const buckets: number[] = []
  let current = bucketStart(startTime, bucketSizeMs)
  const last = bucketStart(endTime, bucketSizeMs)
  while (current <= last) {
    buckets.push(current)
    current += bucketSizeMs
  }
  return buckets
}

/** Read and merge all buckets covering [startTime, endTime], sorted oldest-first. */
export async function readHotRange(
  redis: Redis,
  roomId: string,
  startTime: number,
  endTime: number,
  bucketSizeMs: number
): Promise<ChatMessage[]> {
  const buckets = bucketsInRange(startTime, endTime, bucketSizeMs)
  const results = await Promise.all(buckets.map((b) => readBucket(redis, roomId, b)))
  const messages = results.flat().filter((m) => m.createdAt >= startTime && m.createdAt <= endTime)
  messages.sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id))
  return messages
}

export function isWithinHotWindow(time: number, now: number, retentionMinutes: number): boolean {
  return now - time <= retentionMinutes * 60_000
}
