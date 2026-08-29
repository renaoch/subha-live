import { describe, expect, it } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { addToBucket, bucketStart, bucketsInRange, isWithinHotWindow, readBucket, readHotRange, bucketExists } from '../src/chat/redis/buckets.js'
import type { ChatMessage } from '../src/chat/chat.types.js'

const bucketSizeMs = 5 * 60_000 // 5 minutes

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? `msg_${Math.random().toString(36).slice(2)}`,
    roomId: 'room1',
    userId: 'user1',
    username: 'Renao',
    message: 'there is a ghost',
    createdAt: overrides.createdAt ?? Date.now(),
    ...overrides,
  }
}

describe('bucketStart', () => {
  it('floors a timestamp to the bucket boundary', () => {
    const t = 1_756_380_123_456
    const start = bucketStart(t, bucketSizeMs)
    expect(start % bucketSizeMs).toBe(0)
    expect(start).toBeLessThanOrEqual(t)
  })
})

describe('addToBucket / readBucket (same data structure for write and read)', () => {
  it('writes with XADD and reads back the same message via XRANGE', async () => {
    const redis = new FakeRedis() as any
    const message = makeMessage({ createdAt: 1_756_380_000_000 })
    await addToBucket(redis, 'room1', message, bucketSizeMs, 3600)
    const start = bucketStart(message.createdAt, bucketSizeMs)
    const messages = await readBucket(redis, 'room1', start)
    expect(messages).toEqual([message])
  })

  it('preserves insertion order for multiple messages in the same bucket', async () => {
    const redis = new FakeRedis() as any
    const base = 1_756_380_000_000
    const messages = [makeMessage({ id: 'm1', createdAt: base }), makeMessage({ id: 'm2', createdAt: base + 1000 }), makeMessage({ id: 'm3', createdAt: base + 2000 })]
    for (const m of messages) await addToBucket(redis, 'room1', m, bucketSizeMs, 3600)
    const stored = await readBucket(redis, 'room1', bucketStart(base, bucketSizeMs))
    expect(stored.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('bucketExists reflects whether a bucket has been written', async () => {
    const redis = new FakeRedis() as any
    expect(await bucketExists(redis, 'room1', 0)).toBe(false)
    const message = makeMessage({ createdAt: 5000 })
    await addToBucket(redis, 'room1', message, bucketSizeMs, 3600)
    expect(await bucketExists(redis, 'room1', bucketStart(5000, bucketSizeMs))).toBe(true)
  })
})

describe('bucketsInRange', () => {
  it('enumerates every 5-minute bucket covering a window', () => {
    const start = 0
    const end = bucketSizeMs * 2 + 1
    const buckets = bucketsInRange(start, end, bucketSizeMs)
    expect(buckets).toEqual([0, bucketSizeMs, bucketSizeMs * 2])
  })
})

describe('readHotRange', () => {
  it('merges messages across multiple buckets, sorted by time', async () => {
    const redis = new FakeRedis() as any
    const t0 = 0
    const t1 = bucketSizeMs + 1000
    const early = makeMessage({ id: 'early', createdAt: t0 })
    const later = makeMessage({ id: 'later', createdAt: t1 })
    await addToBucket(redis, 'room1', later, bucketSizeMs, 3600) // insert out of order on purpose
    await addToBucket(redis, 'room1', early, bucketSizeMs, 3600)

    const merged = await readHotRange(redis, 'room1', t0, t1, bucketSizeMs)
    expect(merged.map((m) => m.id)).toEqual(['early', 'later'])
  })

  it('excludes messages outside the requested time bounds even if their bucket overlaps', async () => {
    const redis = new FakeRedis() as any
    const inRange = makeMessage({ id: 'in', createdAt: 1000 })
    const outOfRange = makeMessage({ id: 'out', createdAt: bucketSizeMs - 1 })
    await addToBucket(redis, 'room1', inRange, bucketSizeMs, 3600)
    await addToBucket(redis, 'room1', outOfRange, bucketSizeMs, 3600)

    const result = await readHotRange(redis, 'room1', 0, 1500, bucketSizeMs)
    expect(result.map((m) => m.id)).toEqual(['in'])
  })
})

describe('isWithinHotWindow', () => {
  it('is true for a timestamp within the retention window', () => {
    const now = 1_000_000
    expect(isWithinHotWindow(now - 60_000, now, 60)).toBe(true)
  })
  it('is false for a timestamp older than the retention window', () => {
    const now = 1_000_000
    expect(isWithinHotWindow(now - 61 * 60_000, now, 60)).toBe(false)
  })
})
