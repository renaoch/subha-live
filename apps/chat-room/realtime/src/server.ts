import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import { config } from './infrastructure/config.js'
import { logger } from './infrastructure/logger.js'
import { createRedisClients, closeRedisClients } from './infrastructure/redis.js'
import { createPool } from './infrastructure/postgres.js'
import { SupabaseTokenVerifier } from './infrastructure/supabaseAuth.js'
import { HttpCoreApiAdapter } from './chat/authorization/coreApiAdapter.js'
import { RedisAuthorizationCache } from './chat/authorization/authorizationCache.js'
import { ChatRepository } from './chat/chat.repository.js'
import { ChatService } from './chat/chat.service.js'
import { registerChatGateway } from './chat/chat.gateway.js'
import { ChatPersistenceWorker } from './workers/chat-persistence.worker.js'

async function main() {
  const app = Fastify({
    logger: false,
    // The app sits behind Heroku's router (TLS termination + proxy). Trusting
    // the proxy is what makes request.ip / X-Forwarded-* correct and lets
    // WebSocket upgrades flow through Heroku's WSS routing unchanged.
    trustProxy: true,
    // Message-size validation happens in Zod, but Fastify's own body limit is
    // a hard backstop against arbitrarily large payloads for HTTP routes.
    bodyLimit: 16 * 1024,
  })

  const redis = createRedisClients(config.REDIS_URL)
  const pool = createPool(config)
  const repository = new ChatRepository(pool)
  const coreApiAdapter = new HttpCoreApiAdapter(config)
  const authorizationCache = new RedisAuthorizationCache(redis.command, coreApiAdapter, config)
  const verifier = new SupabaseTokenVerifier(config)
  const chatService = new ChatService(redis.command, redis.publisher, repository, authorizationCache, config)

  await app.register(websocket, {
    // Also cap the WebSocket payload size so large frames are rejected before
    // they ever reach Zod validation.
    options: { maxPayload: 32 * 1024 },
  })

  // CORS for the HTTP endpoints (chat history / health / ready). The WebSocket
  // upgrade is not subject to CORS, but the browser's history `fetch` is.
  // The service authenticates via a Bearer JWT (no cookies), so reflecting the
  // request origin is safe; a fixed allow-list can be set with CORS_ORIGINS.
  const corsOrigins = config.CORS_ORIGINS
    ? config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : true
  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  const { rooms } = await registerChatGateway(app, { config, redis, pool, verifier, chatService })

  const worker = new ChatPersistenceWorker(redis.command, repository, config)
  await worker.start()

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutting down')
    try {
      // 1-2. Stop accepting new HTTP/WebSocket connections.
      await app.close()
      // 3. Notify/close active WebSockets safely.
      for (const sockets of rooms.values()) {
        for (const socket of sockets) socket.close(1001, 'Server shutting down')
      }
      // 4-5. Stop the worker loop and let in-flight persistence finish.
      await worker.stop()
      // 6-7. Close Redis and Postgres.
      await closeRedisClients(redis)
      await pool.end()
      logger.info({}, 'shutdown complete')
      process.exit(0)
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'unknown' }, 'error during shutdown')
      process.exit(1)
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  logger.info({ port: config.PORT }, 'realtime service listening')
}

main().catch((error) => {
  logger.error({ error: error instanceof Error ? error.message : 'unknown' }, 'fatal startup error')
  process.exit(1)
})
