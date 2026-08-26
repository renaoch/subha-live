import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error("Redis REST credentials are not configured");
}

const client = new Redis({ url: redisUrl, token: redisToken });

const commandAliases: Record<string, string> = {
  multi: "pipeline",
  hGetAll: "hgetall",
  hSet: "hset",
  hGet: "hget",
  hDel: "hdel",
  hKeys: "hkeys",
  hIncrBy: "hincrby",
  sAdd: "sadd",
  sRem: "srem",
  sMembers: "smembers",
  sCard: "scard",
  sIsMember: "sismember",
  zAdd: "zadd",
  zRem: "zrem",
  zRange: "zrange",
  zScore: "zscore",
};

/** Compatibility facade so existing services can use node-redis command names
 * while the deployed API uses stateless Upstash REST requests. */
export const redis: any = new Proxy(client as any, {
  get(target, property: string) {
    const command = commandAliases[property] ?? property;
    const value = target[command];
    if (typeof value !== "function") return value;
    return (...args: any[]) => {
      if (command === "del" && Array.isArray(args[0])) args = args[0];
      return value.apply(target, args);
    };
  },
});

export async function connectRedis(): Promise<void> {
  await client.ping();
}

export async function closeRedis(): Promise<void> {}

const LOCK_TTL_SECONDS = 5;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_WAIT_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cacheGet<T>(key: string): Promise<T | null> {
  try { return await client.get<T>(key); }
  catch (error) { console.error(`[redis] GET failed for ${key}:`, error); return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try { await client.set(key, value, { ex: ttlSeconds }); }
  catch (error) { console.error(`[redis] SET failed for ${key}:`, error); }
}

export async function cacheDel(key: string | string[]): Promise<void> {
  try { await client.del(...(Array.isArray(key) ? key : [key])); }
  catch (error) { console.error(`[redis] DEL failed for ${key}:`, error); }
}

export async function getOrSetCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const lockKey = `lock:${key}`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  const acquired = (await client.set(lockKey, token, { nx: true, ex: LOCK_TTL_SECONDS })) === "OK";
  if (acquired) {
    try { const fresh = await fetcher(); await cacheSet(key, fresh, ttlSeconds); return fresh; }
    finally { if ((await client.get<string>(lockKey)) === token) await client.del(lockKey); }
  }
  const start = Date.now();
  while (Date.now() - start < LOCK_MAX_WAIT_MS) {
    await sleep(LOCK_RETRY_DELAY_MS);
    const value = await cacheGet<T>(key);
    if (value !== null) return value;
  }
  return fetcher();
}

export const redisHealth = () => client.ping();
export const isRedisOpen = true;
export { LOCK_TTL_SECONDS };
