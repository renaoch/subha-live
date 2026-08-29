import { describe, expect, it, beforeAll } from 'vitest'
import { SignJWT, generateKeyPair, exportJWK } from 'jose'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { SupabaseTokenVerifier, extractToken } from '../src/infrastructure/supabaseAuth.js'
import type { Config } from '../src/infrastructure/config.js'

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    PORT: 3002,
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    WEBSOCKET_MAX_CONNECTIONS: 10000,
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://x',
    SUPABASE_URL: 'http://127.0.0.1:0',
    SUPABASE_JWT_SECRET: '',
    SUPABASE_JWT_ISSUER: '',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    CORE_API_BASE_URL: 'http://localhost:3001',
    CORE_API_AUTH_ENDPOINT: '/api/rooms/:roomId/authorize',
    CORE_API_PROFILE_ENDPOINT: '/api/users/:userId/profile',
    CORE_API_TIMEOUT_MS: 3000,
    CHAT_MAX_MESSAGE_LENGTH: 500,
    CHAT_RATE_LIMIT_MESSAGES: 10,
    CHAT_RATE_LIMIT_WINDOW_SECONDS: 1,
    CHAT_CONNECTION_RATE_LIMIT: 20,
    CHAT_CONNECTION_RATE_LIMIT_WINDOW_SECONDS: 60,
    CHAT_HISTORY_RATE_LIMIT: 30,
    CHAT_HISTORY_RATE_LIMIT_WINDOW_SECONDS: 60,
    CHAT_HISTORY_LIMIT: 100,
    CHAT_HISTORY_MAX_LIMIT: 500,
    CHAT_REDIS_RETENTION_MINUTES: 60,
    CHAT_BUCKET_SIZE_MINUTES: 5,
    CHAT_PERSISTENCE_BATCH_SIZE: 200,
    CHAT_PERSISTENCE_INTERVAL_MS: 2000,
    CHAT_PERSISTENCE_STREAM_MAXLEN: 200000,
    CHAT_AUTH_CACHE_TTL_SECONDS: 30,
    CHAT_HISTORY_LOCK_TTL_SECONDS: 5,
    ...overrides,
  }
}

describe('extractToken', () => {
  it('reads from Authorization header', () => {
    expect(extractToken('Bearer abc123', undefined)).toBe('abc123')
  })
  it('reads from query string for websocket connections', () => {
    expect(extractToken(undefined, new URLSearchParams('token=xyz'))).toBe('xyz')
  })
  it('returns null when absent', () => {
    expect(extractToken(undefined, new URLSearchParams())).toBeNull()
  })
})

describe('SupabaseTokenVerifier (HS256 legacy shared-secret project)', () => {
  const secret = 'test-shared-secret-value'
  const issuer = 'https://example.supabase.co/auth/v1'
  let verifier: SupabaseTokenVerifier

  beforeAll(() => {
    verifier = new SupabaseTokenVerifier(
      baseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_JWT_SECRET: secret })
    )
  })

  async function sign(payload: Record<string, unknown>, opts: { exp?: string } = {}) {
    const key = new TextEncoder().encode(secret)
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime(opts.exp ?? '1h')
      .sign(key)
  }

  it('accepts a valid token and derives identity only from sub', async () => {
    const token = await sign({ sub: 'user-123', userId: 'attacker-supplied', isHost: true })
    const identity = await verifier.verify(token)
    expect(identity?.sub).toBe('user-123')
  })

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'user-123' }, { exp: '-10s' })
    expect(await verifier.verify(token)).toBeNull()
  })

  it('rejects the wrong issuer', async () => {
    const key = new TextEncoder().encode(secret)
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://not-the-real-project.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(key)
    expect(await verifier.verify(token)).toBeNull()
  })

  it('rejects the wrong audience', async () => {
    const key = new TextEncoder().encode(secret)
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setAudience('service_role')
      .setExpirationTime('1h')
      .sign(key)
    expect(await verifier.verify(token)).toBeNull()
  })

  it('rejects a malformed/garbage token', async () => {
    expect(await verifier.verify('not-a-jwt')).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('wrong-secret'))
    expect(await verifier.verify(token)).toBeNull()
  })
})

describe('SupabaseTokenVerifier (JWKS / asymmetric signing project)', () => {
  let server: Server
  let baseUrl: string
  let verifier: SupabaseTokenVerifier
  let privateKey: CryptoKey
  const kid = 'test-key-1'

  beforeAll(async () => {
    const { privateKey: priv, publicKey } = await generateKeyPair('ES256')
    privateKey = priv
    const jwk = await exportJWK(publicKey)
    jwk.kid = kid
    jwk.alg = 'ES256'

    server = createServer((req, res) => {
      if (req.url?.includes('jwks.json')) {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ keys: [jwk] }))
        return
      }
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    baseUrl = `http://127.0.0.1:${port}`

    verifier = new SupabaseTokenVerifier(baseConfig({ SUPABASE_URL: baseUrl, SUPABASE_JWT_SECRET: '' }))
  })

  it('accepts a token signed with the project JWKS key, using sub as identity', async () => {
    const token = await new SignJWT({ sub: 'user-jwks-1' })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuer(`${baseUrl}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(privateKey)

    const identity = await verifier.verify(token)
    expect(identity?.sub).toBe('user-jwks-1')
  })

  it('rejects an invalid JWKS-signed token when there is no HS256 fallback secret configured', async () => {
    expect(await verifier.verify('garbage.token.value')).toBeNull()
  })
})
