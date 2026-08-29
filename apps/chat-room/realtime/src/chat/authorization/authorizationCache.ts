import type Redis from 'ioredis'
import { redisKeys } from '../redis/keys.js'
import type { Authorization, AuthorizationCache, CoreApiAdapter } from '../chat.types.js'
import type { Config } from '../../infrastructure/config.js'

/**
 * Authentication is always the Supabase JWT. Authorization (room access,
 * membership, host/moderator/mute/ban) is resolved from Core API but cached
 * briefly in Redis so a user sending hundreds of chat messages does not
 * trigger a Core API call per message - only one call per TTL window.
 *
 * The cache is deliberately short-lived and exposes `invalidate` so that,
 * once Core API can emit events (ban, mute, kick), those events can clear a
 * user's cached authorization immediately instead of waiting out the TTL.
 */
export class RedisAuthorizationCache implements AuthorizationCache {
  constructor(
    private readonly redis: Redis,
    private readonly adapter: CoreApiAdapter,
    private readonly config: Config
  ) {}

  async resolve(userId: string, roomId: string, accessToken: string): Promise<Authorization> {
    const key = redisKeys.authCache(userId, roomId)
    const cached = await this.redis.get(key)
    if (cached) return JSON.parse(cached) as Authorization

    const authorization = await this.adapter.resolve(userId, roomId, accessToken)
    await this.redis.set(key, JSON.stringify(authorization), 'EX', this.config.CHAT_AUTH_CACHE_TTL_SECONDS)
    return authorization
  }

  async invalidate(userId: string, roomId?: string): Promise<void> {
    if (roomId) {
      await this.redis.del(redisKeys.authCache(userId, roomId))
      return
    }
    const keys = await this.redis.keys(redisKeys.authCacheUserPrefix(userId))
    if (keys.length) await this.redis.del(...keys)
  }
}
