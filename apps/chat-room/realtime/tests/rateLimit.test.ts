import { describe, expect, it } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { allowTokenBucket } from '../src/chat/redis/rateLimit.js'

describe('allowTokenBucket', () => {
  it('allows up to capacity requests in a burst', async () => {
    const redis = new FakeRedis() as any
    const results: boolean[] = []
    for (let i = 0; i < 10; i++) {
      results.push(await allowTokenBucket(redis, 'chat:rate:user1', 10, 10))
    }
    expect(results.every(Boolean)).toBe(true)
  })

  it('rejects once capacity is exhausted within the same instant', async () => {
    const redis = new FakeRedis() as any
    for (let i = 0; i < 10; i++) await allowTokenBucket(redis, 'chat:rate:user1', 10, 10)
    const eleventh = await allowTokenBucket(redis, 'chat:rate:user1', 10, 10)
    expect(eleventh).toBe(false)
  })

  it('refills gradually over time rather than resetting all at once at a window boundary', async () => {
    const redis = new FakeRedis() as any
    for (let i = 0; i < 5; i++) await allowTokenBucket(redis, 'chat:rate:user2', 5, 5)
    expect(await allowTokenBucket(redis, 'chat:rate:user2', 5, 5)).toBe(false)
    await new Promise((r) => setTimeout(r, 250)) // ~1.25 tokens refilled at 5/sec
    expect(await allowTokenBucket(redis, 'chat:rate:user2', 5, 5)).toBe(true)
  })

  it('tracks separate users independently', async () => {
    const redis = new FakeRedis() as any
    for (let i = 0; i < 3; i++) await allowTokenBucket(redis, 'chat:rate:userA', 3, 3)
    expect(await allowTokenBucket(redis, 'chat:rate:userA', 3, 3)).toBe(false)
    expect(await allowTokenBucket(redis, 'chat:rate:userB', 3, 3)).toBe(true)
  })
})
