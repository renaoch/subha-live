import { describe, expect, it } from 'vitest'
import { FakeRedis } from './fakes/fakeRedis.js'
import { FakePgPool } from './fakes/fakePgPool.js'
import { ChatRepository } from '../src/chat/chat.repository.js'
import { ChatService } from '../src/chat/chat.service.js'
import { loadConfig } from '../src/infrastructure/config.js'
import { ChatError, type Authorization, type AuthorizationCache } from '../src/chat/chat.types.js'

const config = loadConfig()

function cacheReturning(authorization: Authorization): AuthorizationCache {
  return { resolve: async () => authorization, invalidate: async () => {} }
}

function buildService(authCache: AuthorizationCache) {
  const redis = new FakeRedis() as any
  const pool = new FakePgPool()
  const repo = new ChatRepository(pool as any)
  return { service: new ChatService(redis, redis, repo, authCache, config), pool }
}

describe('ChatService.authorizeRoom', () => {
  it('allows an authorized member', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: true, isMember: true }))
    const context = await service.authorizeRoom('user1', 'room1', 'token')
    expect(context.userId).toBe('user1')
    expect(context.username).toBe('Renao')
  })

  it('rejects a denied user with ROOM_FORBIDDEN', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: false }))
    await expect(service.authorizeRoom('user1', 'room1', 'token')).rejects.toMatchObject({ code: 'ROOM_FORBIDDEN' })
  })

  it('rejects a banned user (canAccess false as resolved by the adapter)', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: false, isBanned: true }))
    await expect(service.authorizeRoom('user1', 'room1', 'token')).rejects.toThrow(ChatError)
  })

  it('allows a host', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: true, isHost: true }))
    const context = await service.authorizeRoom('user1', 'room1', 'token')
    expect(context.isHost).toBe(true)
  })

  it('allows a moderator', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: true, isModerator: true }))
    const context = await service.authorizeRoom('user1', 'room1', 'token')
    expect(context.isModerator).toBe(true)
  })

  it('propagates Core API unavailable errors instead of silently allowing access', async () => {
    const authCache: AuthorizationCache = {
      resolve: async () => {
        throw new Error('core api unavailable')
      },
      invalidate: async () => {},
    }
    const { service } = buildService(authCache)
    await expect(service.authorizeRoom('user1', 'room1', 'token')).rejects.toThrow('core api unavailable')
  })
})

describe('ChatService.submitMessage', () => {
  it('builds a canonical message with server-owned id/timestamp/identity', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: true }))
    const context = { userId: 'user1', username: 'Renao', canAccess: true }
    const message = await service.submitMessage(context, 'room1', 'there is a ghost')

    expect(message.userId).toBe('user1')
    expect(message.username).toBe('Renao')
    expect(message.roomId).toBe('room1')
    expect(message.message).toBe('there is a ghost')
    expect(typeof message.id).toBe('string')
    expect(message.id.startsWith('msg_')).toBe(true)
    expect(typeof message.createdAt).toBe('number')
  })

  it('rejects a message from a muted user', async () => {
    const { service } = buildService(cacheReturning({ username: 'Renao', canAccess: true, isMuted: true }))
    const context = { userId: 'user1', username: 'Renao', canAccess: true, isMuted: true }
    await expect(service.submitMessage(context, 'room1', 'hello')).rejects.toMatchObject({ code: 'CHAT_MUTED' })
  })
})
