import type { FastifyInstance } from 'fastify'
import type Redis from 'ioredis'
import type { Config } from '../infrastructure/config.js'
import type { SupabaseTokenVerifier } from '../infrastructure/supabaseAuth.js'
import type { ChatService } from '../chat/chat.service.js'
import { pkKeys } from './pk.keys.js'
import {
  handleBattleConnection,
  handleHostConnection,
  type PkRegistry,
  type PkRequest,
} from './pk.connection.js'

export type PkGatewayDeps = {
  config: Config
  redisCommand: Redis
  subscriber: Redis
  verifier: SupabaseTokenVerifier
  chatService: ChatService
  connectionCount: { value: number }
}

export type PkRegistries = { battles: PkRegistry; hosts: PkRegistry }

/**
 * Registers the PK WebSocket endpoints and the pub/sub subscriptions that fan
 * PK events out to connected battle/host sockets. Reuses the chat service's
 * Supabase JWT auth + Core API authorization.
 */
export async function registerPkGateway(app: FastifyInstance, deps: PkGatewayDeps): Promise<PkRegistries> {
  const { config, redisCommand, subscriber, verifier, chatService, connectionCount } = deps
  const battles: PkRegistry = new Map()
  const hosts: PkRegistry = new Map()

  const connectionDeps = {
    config,
    verifier,
    chatService,
    redisCommand,
    battles,
    hosts,
    connectionCount,
  }

  app.get('/ws/pk/:battleId', { websocket: true }, (socket, request) => {
    const { battleId } = request.params as { battleId: string }
    void handleBattleConnection(socket, battleId, request as unknown as PkRequest, connectionDeps)
  })

  app.get('/ws/pk/host/:hostId', { websocket: true }, (socket, request) => {
    const { hostId } = request.params as { hostId: string }
    void handleHostConnection(socket, hostId, request as unknown as PkRequest, connectionDeps)
  })

  // Subscribe once and route by the pattern (battle vs host channels), so the
  // chat service's own pmessage handler is never confused by PK traffic.
  await subscriber.psubscribe(pkKeys.battleChannelPattern, pkKeys.hostChannelPattern)
  subscriber.on('pmessage', (pattern, channel, payload) => {
    if (pattern === pkKeys.battleChannelPattern) {
      const battleId = channel.slice(pkKeys.battleChannel('').length)
      for (const socket of battles.get(battleId) ?? []) {
        if (socket.readyState === 1) socket.send(payload)
      }
    } else if (pattern === pkKeys.hostChannelPattern) {
      const hostId = channel.slice(pkKeys.hostChannel('').length)
      for (const socket of hosts.get(hostId) ?? []) {
        if (socket.readyState === 1) socket.send(payload)
      }
    }
  })

  return { battles, hosts }
}
