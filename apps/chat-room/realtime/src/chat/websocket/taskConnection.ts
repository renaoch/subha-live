import type { WebSocket } from 'ws'
import { logger } from '../../infrastructure/logger.js'
import type { Config } from '../../infrastructure/config.js'
import type { SupabaseTokenVerifier } from '../../infrastructure/supabaseAuth.js'
import { extractToken } from '../../infrastructure/supabaseAuth.js'
import { ChatError, wsError, type AuthorizedContext } from '../chat.types.js'
import type { ChatService } from '../chat.service.js'
import { metrics } from '../../infrastructure/metrics.js'
import { registerSocket, unregisterSocket, type RoomRegistry } from './connection.js'

export type TaskConnectionDeps = {
  config: Config
  verifier: SupabaseTokenVerifier
  chatService: ChatService
  rooms: RoomRegistry
  connectionCount: { value: number }
}

/**
 * Host-task realtime connection. Mirrors the chat connection's strict
 * ordering (connect -> authenticate JWT -> Core API authorization -> register)
 * but is server->client push only: task progress and claims flow through the
 * HTTP API (the backend is the source of truth), and this socket simply
 * receives task events published onto the room's task pub/sub channel.
 */
export async function handleTaskConnection(
  socket: WebSocket,
  roomId: string,
  request: { headers: { authorization?: string }; url?: string },
  deps: TaskConnectionDeps,
): Promise<void> {
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
    logger.warn({ roomId, userId: identity.sub, code }, 'task websocket authorization failed')
    socket.send(JSON.stringify(wsError(code, message)))
    socket.close(1008, code)
    return
  }

  // Authorization succeeded — only now does the socket start receiving room traffic.
  registerSocket(rooms, roomId, socket)
  connectionCount.value++
  metrics.activeConnections.set(connectionCount.value)
  metrics.activeRooms.set(rooms.size)

  // Acknowledge readiness; task events are pushed from here on.
  socket.send(JSON.stringify({ type: 'connected', userId: context.userId, username: context.username }))

  socket.on('close', () => {
    unregisterSocket(rooms, roomId, socket)
    connectionCount.value--
    metrics.activeConnections.set(connectionCount.value)
    metrics.activeRooms.set(rooms.size)
  })
}
