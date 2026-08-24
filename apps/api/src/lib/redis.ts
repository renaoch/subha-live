import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on("error", (error: Error) => {
  console.error("Redis Client Error:", error);
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export { redis };

/* ============================================================ */
/* CACHE-ASIDE HELPERS (concurrency-safe)                        */
/* ============================================================ */

const LOCK_TTL_MS = 5000;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_WAIT_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Redis GET failed for key "${key}":`, error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.error(`Redis SET failed for key "${key}":`, error);
  }
}

export async function cacheDel(key: string | string[]): Promise<void> {
  try {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;
    await redis.del(keys);
  } catch (error) {
    console.error(`Redis DEL failed for key(s) "${key}":`, error);
  }
}

/**
 * Cache-aside read-through with a distributed lock.
 *
 * Why the lock matters for concurrency:
 * If 500 users load the same page at once and the cache is cold,
 * without a lock all 500 requests hit Supabase/Postgres at the same
 * time ("cache stampede"), which is exactly what causes slow/failed
 * requests under load. With the lock, only ONE request computes the
 * value; everyone else briefly waits for it to land in Redis, then
 * reads the cached result instead of re-querying the DB.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const lockKey = `lock:${key}`;
  const lockToken = `${process.pid}-${Date.now()}-${Math.random()}`;

  let haveLock = false;

  try {
    const result = await redis.set(lockKey, lockToken, {
      NX: true,
      PX: LOCK_TTL_MS,
    });
    haveLock = result === "OK";
  } catch (error) {
    console.error(`Redis LOCK failed for key "${key}":`, error);
  }

  if (haveLock) {
    try {
      const fresh = await fetcher();
      await cacheSet(key, fresh, ttlSeconds);
      return fresh;
    } finally {
      try {
        const current = await redis.get(lockKey);
        if (current === lockToken) {
          await redis.del(lockKey);
        }
      } catch (error) {
        console.error(`Redis UNLOCK failed for key "${key}":`, error);
      }
    }
  }

  // Someone else is already computing this value right now.
  // Poll the cache briefly instead of hammering the DB again.
  const waitStart = Date.now();

  while (Date.now() - waitStart < LOCK_MAX_WAIT_MS) {
    await sleep(LOCK_RETRY_DELAY_MS);

    const value = await cacheGet<T>(key);
    if (value !== null) {
      return value;
    }
  }

  // Lock holder took too long or Redis hiccuped — don't make the
  // user wait forever, just compute it directly.
  return fetcher();
}