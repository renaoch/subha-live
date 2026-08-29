import { logger } from '../../infrastructure/logger.js'
import type { Config } from '../../infrastructure/config.js'
import type { Authorization, CoreApiAdapter } from '../chat.types.js'
import { ChatError } from '../chat.types.js'

function endpointPath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)), template)
}

/**
 * The Chat service owns no users/rooms/membership/permission tables. Every
 * fact about a user's relationship to a room - membership, host/moderator
 * status, mute/ban state, display name - is resolved here, from the existing
 * Core API. If Core API does not yet expose a required field it should be
 * treated as "not granted" rather than inventing local storage for it.
 */
export class HttpCoreApiAdapter implements CoreApiAdapter {
  constructor(private readonly config: Config) {}

  async resolve(userId: string, roomId: string, accessToken: string): Promise<Authorization> {
    const authPath = endpointPath(this.config.CORE_API_AUTH_ENDPOINT, { userId, roomId })
    const profilePath = endpointPath(this.config.CORE_API_PROFILE_ENDPOINT, { userId })
    const headers = { authorization: `Bearer ${accessToken}`, accept: 'application/json' }
    const timeout = this.config.CORE_API_TIMEOUT_MS

    let authResponse: Response
    let profileResponse: Response
    try {
      ;[authResponse, profileResponse] = await Promise.all([
        fetch(new URL(authPath, this.config.CORE_API_BASE_URL), { headers, signal: AbortSignal.timeout(timeout) }),
        fetch(new URL(profilePath, this.config.CORE_API_BASE_URL), { headers, signal: AbortSignal.timeout(timeout) }),
      ])
    } catch (error) {
      logger.warn({ userId, roomId, error: error instanceof Error ? error.message : 'unknown' }, 'core api unreachable or timed out')
      throw new ChatError('CORE_API_UNAVAILABLE', 'Authorization service unavailable')
    }

    if (!authResponse.ok || !profileResponse.ok) {
      logger.warn({ userId, roomId, authStatus: authResponse.status, profileStatus: profileResponse.status }, 'core api rejected authorization lookup')
      throw new ChatError('CORE_API_UNAVAILABLE', 'Authorization service unavailable')
    }

    const auth = (await authResponse.json()) as Record<string, unknown>
    const profile = (await profileResponse.json()) as Record<string, unknown>

    const authorization: Authorization = {
      username: typeof profile.username === 'string' ? profile.username : '',
      canAccess: auth.canAccess === true || auth.allowed === true,
      isMember: auth.isMember === true,
      isHost: auth.isHost === true,
      isModerator: auth.isModerator === true,
      isMuted: auth.isMuted === true,
      isBanned: auth.isBanned === true,
    }

    // Banned or unauthenticated-per-Core-API users cannot access the room at
    // all. Muted users may still connect and read (mute is enforced only
    // when sending a message, see chat.service.ts) so it does not flip
    // canAccess here.
    if (!authorization.username || !authorization.canAccess || authorization.isBanned) {
      return { ...authorization, canAccess: false }
    }
    return authorization
  }
}
