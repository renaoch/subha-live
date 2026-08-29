import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { handleConnection, type RoomRegistry } from '../src/chat/websocket/connection.js'
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

function fakeChatService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    allowConnectionRate: vi.fn(async () => true),
    authorizeRoom: vi.fn(async () => ({ userId: 'user1', username: 'Renao', canAccess: true })),
    allowMessageRate: vi.fn(async () => true),
    submitMessage: vi.fn(async () => ({})),
    ...overrides,
  } as any
}

function fakeVerifier(identity: { sub: string; exp: number; aud: string } | null) {
  return { verify: vi.fn(async () => identity) } as any
}

describe('handleConnection - authorization ordering', () => {
  it('registers the socket in the room only after authorization succeeds', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat?token=abc' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
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

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat?token=abc' }, {
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

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat?token=bad' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
    })

    expect(chatService.authorizeRoom).not.toHaveBeenCalled()
    expect(rooms.size).toBe(0)
  })

  it('rejects and never registers a connection with no token at all', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier(null)

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
    })

    expect(verifier.verify).not.toHaveBeenCalled()
    expect(rooms.size).toBe(0)
  })

  it('removes the socket from the room on close, but does not touch chat history', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService()
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })
    const connectionCount = { value: 0 }

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat?token=abc' }, {
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

  it('rejects a message from a muted user with a structured CHAT_MUTED error, not a stack trace', async () => {
    const rooms: RoomRegistry = new Map()
    const socket = new FakeSocket() as any
    const chatService = fakeChatService({
      submitMessage: vi.fn(async () => {
        throw new ChatError('CHAT_MUTED', 'You are muted in this room')
      }),
    })
    const verifier = fakeVerifier({ sub: 'user1', exp: 9999999999, aud: 'authenticated' })

    await handleConnection(socket, 'room1', { headers: {}, url: '/ws/rooms/room1/chat?token=abc' }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount: { value: 0 },
    })

    socket.emit('message', Buffer.from(JSON.stringify({ type: 'chat_message', message: 'hello' })))
    await new Promise((r) => setTimeout(r, 10))

    const sentError = JSON.parse(socket.sent.at(-1)!)
    expect(sentError).toEqual({ type: 'error', code: 'CHAT_MUTED', message: 'You are muted in this room' })
  })
})
