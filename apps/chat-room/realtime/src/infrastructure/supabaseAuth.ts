import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { logger } from './logger.js'
import type { Config } from './config.js'

export type SupabaseIdentity = { sub: string; exp: number; aud: string }

/**
 * Supabase projects created after the platform's move to asymmetric signing
 * keys expose a JWKS endpoint and sign access tokens with ES256/RS256.
 * Older projects may still be configured with a single shared HS256 secret.
 *
 * Rather than assuming HS256, this verifier:
 *   1. Always tries the project's JWKS endpoint first (works for the current
 *      default configuration and requires no shared secret in this service).
 *   2. Falls back to HS256 with SUPABASE_JWT_SECRET only if that secret was
 *      explicitly configured, for projects still on legacy shared-secret signing.
 *
 * The JWKS key set is cached and auto-refreshed by `jose`.
 */
export class SupabaseTokenVerifier {
  private readonly jwks: JWTVerifyGetKey
  private readonly issuer: string
  private readonly audience: string
  private readonly hs256Secret: Uint8Array | null

  constructor(private readonly config: Config) {
    this.issuer = config.SUPABASE_JWT_ISSUER || `${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`
    this.audience = config.SUPABASE_JWT_AUDIENCE
    this.jwks = createRemoteJWKSet(new URL(`${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`))
    this.hs256Secret = config.SUPABASE_JWT_SECRET ? new TextEncoder().encode(config.SUPABASE_JWT_SECRET) : null
  }

  async verify(token: string): Promise<SupabaseIdentity | null> {
    const viaJwks = await this.tryVerify(token, this.jwks)
    if (viaJwks) return viaJwks
    if (this.hs256Secret) {
      const viaSecret = await this.tryVerify(token, this.hs256Secret, ['HS256'])
      if (viaSecret) return viaSecret
    }
    return null
  }

  private async tryVerify(
    token: string,
    key: JWTVerifyGetKey | Uint8Array,
    algorithms?: string[]
  ): Promise<SupabaseIdentity | null> {
    try {
      const { payload } = await jwtVerify(token, key as JWTVerifyGetKey, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms,
      })
      if (typeof payload.sub !== 'string' || !payload.sub) return null
      if (typeof payload.exp !== 'number') return null
      if (payload.exp * 1000 < Date.now()) return null
      const aud = typeof payload.aud === 'string' ? payload.aud : Array.isArray(payload.aud) ? payload.aud[0] : ''
      return { sub: payload.sub, exp: payload.exp, aud: aud ?? this.audience }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : 'unknown' }, 'supabase token verification attempt failed')
      return null
    }
  }
}

export function extractToken(authHeader: string | undefined, searchParams: URLSearchParams | undefined): string | null {
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  if (searchParams?.has('token')) return searchParams.get('token')
  return null
}
