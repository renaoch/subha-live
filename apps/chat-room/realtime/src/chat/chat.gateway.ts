import type { FastifyInstance } from 'fastify'
import type Redis from 'ioredis'
import type pg from 'pg'
import { errorEnvelope, ChatError, parseCursor } from './chat.types.js'
import { clampHistoryLimit, historyQuerySchema } from './chat.validation.js'
import type { ChatService } from './chat.service.js'
import type { Config } from '../infrastructure/config.js'
import type { SupabaseTokenVerifier } from '../infrastructure/supabaseAuth.js'
import { extractToken } from '../infrastructure/supabaseAuth.js'
import { handleConnection, type RoomRegistry } from './websocket/connection.js'
import { handleTaskConnection } from './websocket/taskConnection.js'
import { subscribeToAllRooms } from './redis/pubsub.js'
import { metricsSnapshot } from '../infrastructure/metrics.js'

export type GatewayDeps = {
  config: Config
  redis: { command: Redis; publisher: Redis; subscriber: Redis }
  pool: pg.Pool
  verifier: SupabaseTokenVerifier
  chatService: ChatService
}

export async function registerChatGateway(app: FastifyInstance, deps: GatewayDeps): Promise<{ rooms: RoomRegistry; connectionCount: { value: number } }> {
  const { config, redis, pool, verifier, chatService } = deps
  const rooms: RoomRegistry = new Map()
  const connectionCount = { value: 0 }

  app.get('/health', async () => ({ status: 'ok' }))

  app.get('/metrics', async () => metricsSnapshot())

  app.get('/ready', async (_request, reply) => {
    try {
      await Promise.all([redis.command.ping(), pool.query('SELECT 1')])
      return { status: 'ready' }
    } catch {
      return reply.code(503).send(errorEnvelope('NOT_READY', 'Dependencies unavailable'))
    }
  })

  app.get('/rooms/:roomId/chat/history', async (request, reply) => {
    const { roomId } = request.params as { roomId: string }
    const query = historyQuerySchema.parse(request.query)
    const token = extractToken(request.headers.authorization, new URLSearchParams(request.query as Record<string, string>))

    if (!token) return reply.code(401).send(errorEnvelope('AUTH_REQUIRED', 'Authentication required'))

    const identity = await verifier.verify(token)
    if (!identity) return reply.code(401).send(errorEnvelope('AUTH_INVALID', 'Invalid or expired authentication'))

    if (!(await chatService.allowHistoryRate(identity.sub))) {
      return reply.code(429).send(errorEnvelope('HISTORY_RATE_LIMITED', 'Too many history requests'))
    }

    try {
      await chatService.authorizeRoom(identity.sub, roomId, token)
      const limit = clampHistoryLimit(query.limit, config)
      const page = await chatService.getHistory(roomId, parseCursor(query.before), limit)
      return page
    } catch (error) {
      if (error instanceof ChatError) {
        const status = error.code === 'ROOM_FORBIDDEN' ? 403 : 503
        return reply.code(status).send(errorEnvelope(error.code, error.message))
      }
      return reply.code(503).send(errorEnvelope('HISTORY_UNAVAILABLE', 'Chat history unavailable'))
    }
  })

  app.get('/ws/rooms/:roomId/chat', { websocket: true }, (socket, request) => {
    const { roomId } = request.params as { roomId: string }
    void handleConnection(socket, roomId, request as { headers: { authorization?: string }; url?: string }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount,
    })
  })

  // Host-task realtime: server -> client push only. Reuses the same auth /
  // authorization / room registry, so task events published onto
  // `pubsub:room:*:task` reach every task socket in the room.
  app.get('/ws/rooms/:roomId/task', { websocket: true }, (socket, request) => {
    const { roomId } = request.params as { roomId: string }
    void handleTaskConnection(socket, roomId, request as { headers: { authorization?: string }; url?: string }, {
      config,
      verifier,
      chatService,
      rooms,
      connectionCount,
    })
  })

  await subscribeToAllRooms(redis.subscriber, (roomId, payload) => {
    for (const socket of rooms.get(roomId) ?? []) {
      if (socket.readyState === 1) socket.send(payload)
    }
  })

  return { rooms, connectionCount }
}
