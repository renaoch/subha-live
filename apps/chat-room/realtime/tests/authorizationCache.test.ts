import { describe, expect, it, vi } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { RedisAuthorizationCache } from '../src/chat/authorization/authorizationCache.js'
import type { Authorization, CoreApiAdapter } from '../src/chat/chat.types.js'
import { loadConfig } from '../src/infrastructure/config.js'

const config = loadConfig()

function fakeAdapter(result: Authorization | (() => Promise<Authorization>)) {
  const resolve = vi.fn(async () => (typeof result === 'function' ? result() : result))
  const adapter: CoreApiAdapter = { resolve }
  return { adapter, resolve }
}

describe('RedisAuthorizationCache', () => {
  it('calls the Core API adapter once and caches the result', async () => {
    const redis = new FakeRedis() as any
    const { adapter, resolve } = fakeAdapter({ username: 'Renao', canAccess: true })
    const cache = new RedisAuthorizationCache(redis, adapter, config)

    const first = await cache.resolve('user1', 'room1', 'token')
    const second = await cache.resolve('user1', 'room1', 'token')

    expect(first).toEqual({ username: 'Renao', canAccess: true })
    expect(second).toEqual(first)
    expect(resolve).toHaveBeenCalledTimes(1) // second call served from cache, not another Core API round trip
  })

  it('does not call the adapter again for a different room with a separate cache entry mixing up', async () => {
    const redis = new FakeRedis() as any
    const { adapter, resolve } = fakeAdapter({ username: 'Renao', canAccess: true })
    const cache = new RedisAuthorizationCache(redis, adapter, config)

    await cache.resolve('user1', 'room1', 'token')
    await cache.resolve('user1', 'room2', 'token')
    expect(resolve).toHaveBeenCalledTimes(2) // different room -> different cache key -> real lookup
  })

  it('propagates a denied authorization (host/moderator/mute/ban all flow through as-is)', async () => {
    const redis = new FakeRedis() as any
    const banned: Authorization = { username: 'Renao', canAccess: false, isBanned: true }
    const { adapter } = fakeAdapter(banned)
    const cache = new RedisAuthorizationCache(redis, adapter, config)
    expect(await cache.resolve('user1', 'room1', 'token')).toEqual(banned)
  })

  it('invalidate(userId, roomId) clears only that room\'s cache entry', async () => {
    const redis = new FakeRedis() as any
    let callCount = 0
    const { adapter } = fakeAdapter(async () => {
      callCount++
      return { username: 'Renao', canAccess: true }
    })
    const cache = new RedisAuthorizationCache(redis, adapter, config)

    await cache.resolve('user1', 'room1', 'token')
    await cache.invalidate('user1', 'room1')
    await cache.resolve('user1', 'room1', 'token')
    expect(callCount).toBe(2) // re-fetched after invalidation instead of serving stale cache
  })

  it('invalidate(userId) without a room sweeps all of that user\'s cached rooms', async () => {
    const redis = new FakeRedis() as any
    let callCount = 0
    const { adapter } = fakeAdapter(async () => {
      callCount++
      return { username: 'Renao', canAccess: true }
    })
    const cache = new RedisAuthorizationCache(redis, adapter, config)

    await cache.resolve('user1', 'roomA', 'token')
    await cache.resolve('user1', 'roomB', 'token')
    await cache.invalidate('user1')
    await cache.resolve('user1', 'roomA', 'token')
    await cache.resolve('user1', 'roomB', 'token')
    expect(callCount).toBe(4)
  })

  it('propagates a Core API unavailable/timeout error rather than caching a fake result', async () => {
    const redis = new FakeRedis() as any
    const adapter: CoreApiAdapter = {
      resolve: vi.fn(async () => {
        throw new Error('core api unavailable')
      }),
    }
    const cache = new RedisAuthorizationCache(redis, adapter, config)
    await expect(cache.resolve('user1', 'room1', 'token')).rejects.toThrow('core api unavailable')
  })
})
