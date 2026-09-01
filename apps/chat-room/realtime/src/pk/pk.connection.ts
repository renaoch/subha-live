import type { WebSocket } from 'ws'
import { logger } from '../infrastructure/logger.js'
import type { Config } from '../infrastructure/config.js'
import type { SupabaseTokenVerifier } from '../infrastructure/supabaseAuth.js'
import { extractToken } from '../infrastructure/supabaseAuth.js'
import { ChatError, wsError } from '../chat/chat.types.js'
import type { ChatService } from '../chat/chat.service.js'
import { metrics } from '../infrastructure/metrics.js'
import type { RoomRegistry } from '../chat/websocket/connection.js'
import { readBattleState, stateSyncEvent } from './pk.state.js'
import type Redis from 'ioredis'

export type PkRegistry = Map<string, Set<WebSocket>>

export type PkConnectionDeps = {
  config: Config
  verifier: SupabaseTokenVerifier
  chatService: ChatService
  redisCommand: Redis
  battles: PkRegistry
  hosts: PkRegistry
  connectionCount: { value: number }
}

export type PkRequest = { headers: { authorization?: string }; url?: string }

/** Shared auth + rate-limit preamble; returns the verified identity or null (socket closed). */
async function authenticate(socket: WebSocket, request: PkRequest, deps: PkConnectionDeps): Promise<string | null> {
  const { config, verifier, chatService, connectionCount } = deps
  const searchParams = new URL(request.url ?? '', 'http://localhost').searchParams
  const token = extractToken(request.headers.authorization, searchParams)

  if (!token) {
    socket.send(JSON.stringify(wsError('AUTH_REQUIRED', 'Authentication required')))
    socket.close(1008, 'Authentication required')
    return null
  }
  if (connectionCount.value >= config.WEBSOCKET_MAX_CONNECTIONS) {
    socket.send(JSON.stringify(wsError('CONNECTION_LIMIT', 'Server connection limit reached')))
    socket.close(1013, 'Connection limit reached')
    return null
  }
  const identity = await verifier.verify(token)
  if (!identity) {
    socket.send(JSON.stringify(wsError('AUTH_INVALID', 'Invalid or expired authentication')))
    socket.close(1008, 'Invalid authentication')
    return null
  }
  if (!(await chatService.allowConnectionRate(identity.sub))) {
    metrics.rateLimitRejectionsTotal.inc()
    socket.send(JSON.stringify(wsError('CONNECTION_RATE_LIMITED', 'Too many connection attempts')))
    socket.close(1008, 'Rate limited')
    return null
  }
  return identity.sub
}

function register(registry: PkRegistry, key: string, socket: WebSocket, connectionCount: { value: number }): void {
  const set = registry.get(key) ?? new Set<WebSocket>()
  set.add(socket)
  registry.set(key, set)
  connectionCount.value++
  metrics.activeConnections.set(connectionCount.value)
}

function unregister(registry: PkRegistry, key: string, socket: WebSocket, connectionCount: { value: number }): void {
  const set = registry.get(key)
  if (!set) return
  set.delete(socket)
  if (!set.size) registry.delete(key)
  connectionCount.value--
  metrics.activeConnections.set(connectionCount.value)
}

/**
 * Battle subscription: a viewer joins a live PK and receives an immediate
 * PK_STATE_SYNC followed by future battle events. The viewer must be able to
 * access at least one of the two host rooms (resolved via the existing Core
 * API authorization).
 */
export async function handleBattleConnection(
  socket: WebSocket,
  battleId: string,
  request: PkRequest,
  deps: PkConnectionDeps,
): Promise<void> {
  const { chatService, redisCommand, battles, connectionCount } = deps
  const userId = await authenticate(socket, request, deps)
  if (!userId) return

  const state = await readBattleState(redisCommand, battleId)
  if (!state) {
    socket.send(JSON.stringify(wsError('PK_NOT_FOUND', 'Battle not found')))
    socket.close(1008, 'PK_NOT_FOUND')
    return
  }

  // Authorize against at least one of the two rooms. Do not bypass room auth.
  const token = extractToken(request.headers.authorization, new URL(request.url ?? '', 'http://localhost').searchParams) ?? ''
  const roomAOk = await tryAuthorize(chatService, userId, state.roomA, token)
  const roomBOk = roomAOk || (await tryAuthorize(chatService, userId, state.roomB, token))
  if (!roomBOk) {
    logger.warn({ battleId, userId }, 'pk authorization denied')
    socket.send(JSON.stringify(wsError('ROOM_FORBIDDEN', 'Room access denied')))
    socket.close(1008, 'ROOM_FORBIDDEN')
    return
  }

  register(battles, battleId, socket, connectionCount)
  socket.send(JSON.stringify(stateSyncEvent(state)))

  socket.on('close', () => unregister(battles, battleId, socket, connectionCount))
}

/**
 * Host subscription: the host listens for directed events (PK_INVITE /
 * PK_ACCEPT / PK_DECLINE). Only the host themselves may connect.
 */
export async function handleHostConnection(
  socket: WebSocket,
  hostId: string,
  request: PkRequest,
  deps: PkConnectionDeps,
): Promise<void> {
  const { hosts, connectionCount } = deps
  const userId = await authenticate(socket, request, deps)
  if (!userId) return

  if (userId !== hostId) {
    socket.send(JSON.stringify(wsError('FORBIDDEN', 'Not your host channel')))
    socket.close(1008, 'FORBIDDEN')
    return
  }

  register(hosts, hostId, socket, connectionCount)
  socket.send(JSON.stringify({ type: 'connected', userId }))
  socket.on('close', () => unregister(hosts, hostId, socket, connectionCount))
}

async function tryAuthorize(
  chatService: ChatService,
  userId: string,
  roomId: string,
  token: string,
): Promise<boolean> {
  if (!roomId) return false
  try {
    await chatService.authorizeRoom(userId, roomId, token)
    return true
  } catch (error) {
    if (error instanceof ChatError && error.code === 'ROOM_FORBIDDEN') return false
    // Core API unavailable etc. — fail closed.
    return false
  }
}
