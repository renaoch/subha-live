import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { handleBattleConnection, handleHostConnection, type PkRegistry } from '../src/pk/pk.connection.js'
import { loadConfig } from '../src/infrastructure/config.js'
import { ChatError } from '../src/chat/chat.types.js'

class FakeSocket extends EventEmitter {
  readyState = 1
  sent: string[] = []
  closed: { code: number; reason: string } | null = null
  send(data: string) {
    this.sent.push(data)
  }
  close(code: number, reason: string) {
    this.closed = { code, reason }
    this.emit('close')
  }
}

const config = loadConfig()

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  const battles: PkRegistry = new Map()
  const hosts: PkRegistry = new Map()
  const base = {
    config,
    verifier: { verify: vi.fn(async () => ({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })) },
    chatService: {
      allowConnectionRate: vi.fn(async () => true),
      authorizeRoom: vi.fn(async () => ({ userId: 'user1', username: 'Renao', canAccess: true })),
    },
    redisCommand: {
      hgetall: vi.fn(async () => ({
        battleId: 'b1',
        status: 'ACTIVE',
        hostA: 'hostA',
        hostB: 'hostB',
        roomA: 'roomA',
        roomB: 'roomB',
        scoreA: '0',
        scoreB: '0',
        startedAt: '1',
        endsAt: '2',
        version: '0',
      })),
    },
    battles,
    hosts,
    connectionCount: { value: 0 },
    ...overrides,
  }
  return { ...base, battles, hosts }
}

describe('handleBattleConnection', () => {
  it('registers the socket and sends PK_STATE_SYNC after auth + authorization', async () => {
    const d = deps()
    const socket = new FakeSocket() as any
    await handleBattleConnection(socket, 'b1', { headers: {}, url: '/ws/pk/b1?token=abc' }, d)

    expect(d.chatService.authorizeRoom).toHaveBeenCalled()
    expect(d.battles.get('b1')?.has(socket)).toBe(true)
    expect(JSON.parse(socket.sent[0]).type).toBe('PK_STATE_SYNC')
    expect(JSON.parse(socket.sent[0]).battleId).toBe('b1')
  })

  it('rejects a missing token and never registers the socket', async () => {
    const d = deps({ verifier: { verify: vi.fn() } })
    const socket = new FakeSocket() as any
    await handleBattleConnection(socket, 'b1', { headers: {}, url: '/ws/pk/b1' }, d)
    expect(d.battles.size).toBe(0)
    expect(socket.closed?.code).toBe(1008)
  })

  it('rejects when the battle is not found in Redis', async () => {
    const d = deps({ redisCommand: { hgetall: vi.fn(async () => ({})) } })
    const socket = new FakeSocket() as any
    await handleBattleConnection(socket, 'b1', { headers: {}, url: '/ws/pk/b1?token=abc' }, d)
    expect(d.battles.size).toBe(0)
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'error', code: 'PK_NOT_FOUND', message: 'Battle not found' })
  })

  it('rejects when the viewer cannot access either room', async () => {
    const d = deps({
      chatService: {
        allowConnectionRate: vi.fn(async () => true),
        authorizeRoom: vi.fn(async () => {
          throw new ChatError('ROOM_FORBIDDEN', 'Room access denied')
        }),
      },
    })
    const socket = new FakeSocket() as any
    await handleBattleConnection(socket, 'b1', { headers: {}, url: '/ws/pk/b1?token=abc' }, d)
    expect(d.battles.size).toBe(0)
    expect(socket.closed?.code).toBe(1008)
  })

  it('removes the socket on close', async () => {
    const d = deps()
    const socket = new FakeSocket() as any
    await handleBattleConnection(socket, 'b1', { headers: {}, url: '/ws/pk/b1?token=abc' }, d)
    expect(d.battles.get('b1')?.has(socket)).toBe(true)
    socket.emit('close')
    expect(d.battles.get('b1')).toBeUndefined()
  })
})

describe('handleHostConnection', () => {
  it('registers the host and sends a connected ack when the identity matches', async () => {
    const d = deps()
    const socket = new FakeSocket() as any
    await handleHostConnection(socket, 'user1', { headers: {}, url: '/ws/pk/host/user1?token=abc' }, d)
    expect(d.hosts.get('user1')?.has(socket)).toBe(true)
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'connected', userId: 'user1' })
  })

  it('rejects a socket whose identity does not match the host id', async () => {
    const d = deps()
    const socket = new FakeSocket() as any
    await handleHostConnection(socket, 'someone-else', { headers: {}, url: '/ws/pk/host/someone-else?token=abc' }, d)
    expect(d.hosts.size).toBe(0)
    expect(socket.closed?.code).toBe(1008)
  })
})
