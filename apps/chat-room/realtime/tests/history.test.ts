import { describe, expect, it } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { FakePgPool } from './fakes/fakePgPool.js'
import { ChatRepository } from '../src/chat/chat.repository.js'
import { ChatService } from '../src/chat/chat.service.js'
import { addToBucket, bucketSizeMsFromMinutes, bucketStart } from '../src/chat/redis/buckets.js'
import { loadConfig } from '../src/infrastructure/config.js'
import type { Authorization, AuthorizationCache, ChatMessage } from '../src/chat/chat.types.js'

const config = loadConfig({ ...process.env, CHAT_REDIS_RETENTION_MINUTES: '60', CHAT_BUCKET_SIZE_MINUTES: '5' } as any)
const bucketSizeMs = bucketSizeMsFromMinutes(config.CHAT_BUCKET_SIZE_MINUTES)

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: 'm', roomId: 'room1', userId: 'u1', username: 'Renao', message: 'hi', createdAt: Date.now(), ...overrides }
}

function allowAllAuthCache(): AuthorizationCache {
  const authorization: Authorization = { username: 'Renao', canAccess: true }
  return { resolve: async () => authorization, invalidate: async () => {} }
}

describe('ChatService.getHistory', () => {
  it('serves from the hot Redis bucket when the requested range is within the hot window', async () => {
    const redis = new FakeRedis() as any
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const service = new ChatService(redis, redis, repo, allowAllAuthCache(), config)

    const now = Date.now()
    const message = msg({ id: 'hot1', createdAt: now })
    await addToBucket(redis, 'room1', message, bucketSizeMs, 3600)
    // Deliberately do NOT put it in Postgres, to prove this path avoids Postgres.
    const page = await service.getHistory('room1', undefined, 10)

    expect(page.messages.map((m) => m.id)).toContain('hot1')
    expect(pool.queryLog.some((q) => q.includes('FROM chat_messages'))).toBe(false)
  })

  it('falls back to Postgres when the hot bucket is empty (cache miss)', async () => {
    const redis = new FakeRedis() as any
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const service = new ChatService(redis, redis, repo, allowAllAuthCache(), config)

    await repo.persistBatch([msg({ id: 'cold1', createdAt: Date.now() })])
    // No hot bucket written - forces the miss path.
    const page = await service.getHistory('room1', undefined, 10)

    expect(page.messages.map((m) => m.id)).toContain('cold1')
    expect(pool.queryLog.some((q) => q.includes('FROM chat_messages'))).toBe(true)
  })

  it('goes straight to Postgres for a time range outside the hot retention window', async () => {
    const redis = new FakeRedis() as any
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const service = new ChatService(redis, redis, repo, allowAllAuthCache(), config)

    const old = Date.now() - (config.CHAT_REDIS_RETENTION_MINUTES + 30) * 60_000
    await repo.persistBatch([msg({ id: 'ancient', createdAt: old })])

    const page = await service.getHistory('room1', { createdAt: old + 60_000, id: 'zzz' }, 10)
    expect(page.messages.map((m) => m.id)).toContain('ancient')
  })

  it('never returns more than the requested (bounded) limit', async () => {
    const redis = new FakeRedis() as any
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const service = new ChatService(redis, redis, repo, allowAllAuthCache(), config)

    await repo.persistBatch(Array.from({ length: 50 }, (_, i) => msg({ id: `m${i}`, createdAt: Date.now() - i * 1000 })))
    const page = await service.getHistory('room1', undefined, 5)
    expect(page.messages.length).toBeLessThanOrEqual(5)
  })

  it('cache-stampede: hundreds of simultaneous requests for the same missing bucket cause only one Postgres query', async () => {
    const redis = new FakeRedis() as any
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const service = new ChatService(redis, redis, repo, allowAllAuthCache(), config)

    await repo.persistBatch([msg({ id: 'stampede1', createdAt: Date.now() })])
    // No hot bucket -> every request would naively hit Postgres without single-flight.

    const requests = Array.from({ length: 200 }, () => service.getHistory('room1', undefined, 10))
    const pages = await Promise.all(requests)

    expect(pages.every((p) => p.messages.some((m) => m.id === 'stampede1'))).toBe(true)
    const historyQueries = pool.queryLog.filter((q) => q.includes('ORDER BY created_at DESC'))
    expect(historyQueries).toHaveLength(1)
  })
})
