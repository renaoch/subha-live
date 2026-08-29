import { describe, expect, it } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { acquireLock, releaseLock, withSingleFlight } from '../src/chat/redis/lock.js'

describe('acquireLock / releaseLock', () => {
  it('successfully acquires a free lock', async () => {
    const redis = new FakeRedis() as any
    const lock = await acquireLock(redis, 'lock:a', 5)
    expect(lock).not.toBeNull()
  })

  it('fails to acquire an already-held lock', async () => {
    const redis = new FakeRedis() as any
    await acquireLock(redis, 'lock:a', 5)
    const second = await acquireLock(redis, 'lock:a', 5)
    expect(second).toBeNull()
  })

  it('releases only if the caller still owns the lock (safe compare-and-delete)', async () => {
    const redis = new FakeRedis() as any
    const owner = await acquireLock(redis, 'lock:a', 5)
    expect(owner).not.toBeNull()

    // A different, unrelated token must never be able to delete someone else's lock.
    await releaseLock(redis, { key: 'lock:a', token: 'not-the-real-token' })
    const stillHeld = await acquireLock(redis, 'lock:a', 5)
    expect(stillHeld).toBeNull() // still held by the original owner

    await releaseLock(redis, owner!)
    const afterRealRelease = await acquireLock(redis, 'lock:a', 5)
    expect(afterRealRelease).not.toBeNull()
  })

  it('a request never deletes another request\'s lock even with the same key after re-acquisition', async () => {
    const redis = new FakeRedis() as any
    const first = await acquireLock(redis, 'lock:a', 5)
    await releaseLock(redis, first!)
    const second = await acquireLock(redis, 'lock:a', 5)
    expect(second).not.toBeNull()
    // Attempting to release using the first (now stale) token must not affect the second lock.
    await releaseLock(redis, first!)
    const third = await acquireLock(redis, 'lock:a', 5)
    expect(third).toBeNull() // second's lock is untouched
  })
})

describe('withSingleFlight (cache stampede protection)', () => {
  it('runs compute exactly once for hundreds of concurrent identical requests', async () => {
    const redis = new FakeRedis() as any
    let computeCalls = 0
    let cachedValue: number | null = null

    const run = () =>
      withSingleFlight<number>({
        redis,
        lockKey: 'chat:history:lock:room1:1000',
        lockTtlSeconds: 5,
        readCache: async () => cachedValue,
        compute: async () => {
          computeCalls++
          await new Promise((r) => setTimeout(r, 20))
          return 42
        },
        writeCache: async (value) => {
          cachedValue = value
        },
      })

    const results = await Promise.all(Array.from({ length: 300 }, () => run()))
    expect(computeCalls).toBe(1)
    expect(results.every((r) => r.value === 42)).toBe(true)
    expect(results.filter((r) => r.source === 'computed')).toHaveLength(1)
  })

  it('returns immediately from cache when already populated, without acquiring a lock', async () => {
    const redis = new FakeRedis() as any
    let computeCalls = 0
    const result = await withSingleFlight<number>({
      redis,
      lockKey: 'lock:x',
      lockTtlSeconds: 5,
      readCache: async () => 7,
      compute: async () => {
        computeCalls++
        return 99
      },
      writeCache: async () => {},
    })
    expect(result).toEqual({ value: 7, source: 'cache' })
    expect(computeCalls).toBe(0)
  })
})
