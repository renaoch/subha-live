import type Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { metrics } from '../../infrastructure/metrics.js'

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`

export type Lock = { key: string; token: string }

/** Acquire a lock, returning a token that must be presented to release it. */
export async function acquireLock(redis: Redis, key: string, ttlSeconds: number): Promise<Lock | null> {
  const token = randomUUID()
  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX')
  return result === 'OK' ? { key, token } : null
}

/** Release a lock only if this caller still owns it (compare-and-delete, atomic via Lua). */
export async function releaseLock(redis: Redis, lock: Lock): Promise<void> {
  await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token)
}

export type SingleFlightResult<T> = { value: T; source: 'cache' | 'computed' }

/**
 * Bounded single-flight: only the lock owner computes `compute()`. All other
 * concurrent callers poll the cache (not Postgres) with short backoff until
 * either the cache is populated or the lock expires, at which point one of
 * them races to acquire the now-free lock and compute itself. This guarantees
 * at most a small, bounded number of underlying computations even under a
 * stampede of hundreds of simultaneous callers, rather than one computation
 * per caller.
 */
export async function withSingleFlight<T>(options: {
  redis: Redis
  lockKey: string
  lockTtlSeconds: number
  readCache: () => Promise<T | null>
  compute: () => Promise<T>
  writeCache: (value: T) => Promise<void>
  maxWaitMs?: number
  pollIntervalMs?: number
}): Promise<SingleFlightResult<T>> {
  const { redis, lockKey, lockTtlSeconds, readCache, compute, writeCache } = options
  const maxWaitMs = options.maxWaitMs ?? lockTtlSeconds * 1000 + 1000
  const pollIntervalMs = options.pollIntervalMs ?? 40

  const cached = await readCache()
  if (cached !== null) return { value: cached, source: 'cache' }

  const lock = await acquireLock(redis, lockKey, lockTtlSeconds)
  if (lock) {
    try {
      const value = await compute()
      await writeCache(value)
      return { value, source: 'computed' }
    } finally {
      await releaseLock(redis, lock)
    }
  }

  // Someone else owns the lock. Wait, re-checking the cache, not Postgres.
  metrics.lockContentionTotal.inc()
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)
    const waited = await readCache()
    if (waited !== null) return { value: waited, source: 'cache' }
    // Lock owner may have died without writing the cache; try to take over.
    const takeover = await acquireLock(redis, lockKey, lockTtlSeconds)
    if (takeover) {
      try {
        const value = await compute()
        await writeCache(value)
        return { value, source: 'computed' }
      } finally {
        await releaseLock(redis, takeover)
      }
    }
  }

  // Last resort: compute without a lock rather than hang forever. This only
  // triggers if the lock owner never released and never wrote a result within
  // the full TTL window, which should not happen in normal operation.
  const value = await compute()
  await writeCache(value)
  return { value, source: 'computed' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
