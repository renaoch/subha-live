import Redis from 'ioredis'
import { logger } from './logger.js'

export type RedisClients = {
  command: Redis
  publisher: Redis
  subscriber: Redis
}

/**
 * Three isolated Redis connections:
 *  - command: general reads/writes, locks, rate limiting, streams
 *  - publisher: PUBLISH only
 *  - subscriber: SUBSCRIBE/PSUBSCRIBE only (a subscribing connection can't run other commands)
 */
export function createRedisClients(url: string): RedisClients {
  const options = { maxRetriesPerRequest: null as null, enableReadyCheck: false }
  const command = new Redis(url, options)
  const publisher = new Redis(url, options)
  const subscriber = new Redis(url, options)

  for (const [name, client] of Object.entries({ command, publisher, subscriber })) {
    client.on('error', (error) => logger.error({ client: name, error: error.message }, 'redis client error'))
  }

  return { command, publisher, subscriber }
}

export async function closeRedisClients(clients: RedisClients): Promise<void> {
  await Promise.allSettled([clients.command.quit(), clients.publisher.quit(), clients.subscriber.quit()])
}
