import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { handleTaskConnection } from '../src/chat/websocket/taskConnection.js'
import { loadConfig } from '../src/infrastructure/config.js'
import { ChatError } from '../src/chat/chat.types.js'
import type { RoomRegistry } from '../src/chat/websocket/connection.js'

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

function fakeChatService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    allowConnectionRate: vi.fn(async () => true),
    authorizeRoom: vi.fn(async () => ({ userId: 'user1', username: 'Renao', canAccess: true })),
    ...overrides,
  } as any
}

function fakeVerifier(identity: { sub: string; exp: number; aud: string } | null) {
  return { verify: vi.fn(async () => identity) } as any
}

describe('handleTaskConnection - authorization ordering', () => {
  it('registers the socket only after authorization succeeds and acks "connected"', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })
    const connectionCount = { value: 0 }

    await handleTaskConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/task?token=abc' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount,
    })

    expect(chatService.authorizeRoom).toHaveBeenCalled()
    expect(rooms.get('room1')?.has(socket)).toBe(true)
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'connected', userId: 'user1', username: 'Renao' })
  })

  it('never registers the socket when room authorization is denied', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService({
      authorizeRoom: vi.fn(async () => {
        throw new ChatError('ROOM_FORBIDDEN', 'Room access denied')
      }),
    })
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })

    await handleTaskConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/task?token=abc' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
    })

    expect(rooms.get('room1')).toBeUndefined()
    expect(socket.closed?.code).toBe(1008)
  })

  it('never registers the socket when the Supabase JWT is invalid', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier(null)

    await handleTaskConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/task?token=bad' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
    })

    expect(chatService.authorizeRoom).not.toHaveBeenCalled()
    expect(rooms.size).toBe(0)
  })

  it('removes the socket from the room on close', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })
    const connectionCount = { value: 0 }

    await handleTaskConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/task?token=abc' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount,
    })
    expect(connectionCount.value).toBe(1)

    socket.emit('close')
    expect(rooms.get('room1')).toBeUndefined()
    expect(connectionCount.value).toBe(0)
  })
})
