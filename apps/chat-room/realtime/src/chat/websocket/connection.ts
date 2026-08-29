import type { WebSocket } from 'ws'
import { z } from 'zod'
import { logger } from '../../infrastructure/logger.js'
import type { Config } from '../../infrastructure/config.js'
import type { SupabaseTokenVerifier } from '../../infrastructure/supabaseAuth.js'
import { extractToken } from '../../infrastructure/supabaseAuth.js'
import { ChatError, wsError, type AuthorizedContext } from '../chat.types.js'
import { chatMessageInputSchema } from '../chat.validation.js'
import type { ChatService } from '../chat.service.js'
import { metrics } from '../../infrastructure/metrics.js'

export type RoomRegistry = Map<string, Set<WebSocket>>

export type ConnectionDeps = {
  config: Config
  verifier: SupabaseTokenVerifier
  chatService: ChatService
  rooms: RoomRegistry
  connectionCount: { value: number }
}

/**
 * Enforces the required order:
 *   connect -> authenticate JWT -> Core API authorization -> resolve permissions
 *   -> ONLY THEN register the socket in the room -> begin receiving/broadcasting
 *
 * The socket is never added to `rooms` until authorization has fully
 * succeeded, so an unauthorized connection can never receive room messages.
 */
export async function handleConnection(socket: WebSocket, roomId: string, request: { headers: { authorization?: string }; url?: string }, deps: ConnectionDeps): Promise<void> {
  const { config, verifier, chatService, rooms, connectionCount } = deps
  const searchParams = new URL(request.url ?? '', 'http://localhost').searchParams
  const token = extractToken(request.headers.authorization, searchParams)

  if (!token) {
    socket.send(JSON.stringify(wsError('AUTH_REQUIRED', 'Authentication required')))
    socket.close(1008, 'Authentication required')
    return
  }

  if (connectionCount.value >= config.WEBSOCKET_MAX_CONNECTIONS) {
    socket.send(JSON.stringify(wsError('CONNECTION_LIMIT', 'Server connection limit reached')))
    socket.close(1013, 'Connection limit reached')
    return
  }

  const identity = await verifier.verify(token)
  if (!identity) {
    socket.send(JSON.stringify(wsError('AUTH_INVALID', 'Invalid or expired authentication')))
    socket.close(1008, 'Invalid authentication')
    return
  }

  if (!(await chatService.allowConnectionRate(identity.sub))) {
    metrics.rateLimitRejectionsTotal.inc()
    socket.send(JSON.stringify(wsError('CONNECTION_RATE_LIMITED', 'Too many connection attempts')))
    socket.close(1008, 'Rate limited')
    return
  }

  let context: AuthorizedContext
  try {
    context = await chatService.authorizeRoom(identity.sub, roomId, token)
  } catch (error) {
    const code = error instanceof ChatError ? error.code : 'AUTH_INVALID'
    const message = error instanceof ChatError ? error.message : 'Authentication failed'
    logger.warn({ roomId, userId: identity.sub, code }, 'websocket authorization failed')
    socket.send(JSON.stringify(wsError(code, message)))
    socket.close(1008, code)
    return
  }

  // Authorization succeeded - only now does the socket start receiving room traffic.
  registerSocket(rooms, roomId, socket)
  connectionCount.value++
  metrics.activeConnections.set(connectionCount.value)
  metrics.activeRooms.set(rooms.size)
  logger.info({ roomId, userId: context.userId }, 'websocket connection authorized')

  // Tell the client authorization is complete and it is now safe to send
  // messages. Without this, a fast client sending immediately on `open`
  // could have its first message dropped, since the `message` listener is
  // only attached after the async authenticate -> authorize chain resolves.
  socket.send(JSON.stringify({ type: 'connected', userId: context.userId, username: context.username }))

  const inputSchema = chatMessageInputSchema(config)

  socket.on('message', async (raw: Buffer) => {
    try {
      const parsed = inputSchema.parse(JSON.parse(raw.toString()))
      if (!(await chatService.allowMessageRate(context.userId, roomId))) {
        metrics.rateLimitRejectionsTotal.inc()
        socket.send(JSON.stringify(wsError('CHAT_RATE_LIMITED', 'Too many messages')))
        return
      }
      await chatService.submitMessage(context, roomId, parsed.message)
    } catch (error) {
      metrics.websocketErrorsTotal.inc()
      if (error instanceof ChatError) {
        socket.send(JSON.stringify(wsError(error.code, error.message)))
        return
      }
      const code = error instanceof z.ZodError ? 'CHAT_INVALID' : 'CHAT_UNAVAILABLE'
      socket.send(JSON.stringify(wsError(code, code === 'CHAT_INVALID' ? 'Invalid chat message' : 'Chat unavailable')))
    }
  })

  socket.on('close', () => {
    unregisterSocket(rooms, roomId, socket)
    connectionCount.value--
    metrics.activeConnections.set(connectionCount.value)
    metrics.activeRooms.set(rooms.size)
    // Only connection/presence state is cleared here. Chat messages already
    // written to the hot bucket, stream, and Postgres are untouched, and the
    // client can recover anything missed via the history cursor API.
  })
}

function registerSocket(rooms: RoomRegistry, roomId: string, socket: WebSocket): void {
  const set = rooms.get(roomId) ?? new Set<WebSocket>()
  set.add(socket)
  rooms.set(roomId, set)
}

function unregisterSocket(rooms: RoomRegistry, roomId: string, socket: WebSocket): void {
  const set = rooms.get(roomId)
  if (!set) return
  set.delete(socket)
  if (!set.size) rooms.delete(roomId)
}
