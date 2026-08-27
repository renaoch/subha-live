import { Redis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";

type RedisBackend = Redis | RedisClientType;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Azure uses REDIS_URL. Upstash REST remains supported for serverless/local deployments.
const client: RedisBackend = redisUrl
  ? createClient({ url: redisUrl })
  : restUrl && restToken
    ? new Redis({ url: restUrl, token: restToken })
    : (() => { throw new Error("Redis is not configured: set REDIS_URL or Upstash REST variables"); })();

const commandAliases: Record<string, string> = {
  multi: "multi", hGetAll: "hGetAll", hSet: "hSet", hGet: "hGet", hDel: "hDel", hKeys: "hKeys", hIncrBy: "hIncrBy",
  sAdd: "sAdd", sRem: "sRem", sMembers: "sMembers", sCard: "sCard", sIsMember: "sIsMember",
  zAdd: "zAdd", zRem: "zRem", zRange: "zRange", zScore: "zScore",
};

// Lowercase-to-camelCase aliases for chained pipeline/multi commands.
// node-redis's multi() chain only exposes camelCase methods (zAdd, hSet,
// sAdd...) while Upstash's pipeline() already uses lowercase — this lets
// call sites always use lowercase and work on either backend.
const chainAliases: Record<string, string> = {
  hset: "hSet", hget: "hGet", hdel: "hDel", hkeys: "hKeys", hincrby: "hIncrBy", hgetall: "hGetAll",
  sadd: "sAdd", srem: "sRem", smembers: "sMembers", scard: "sCard", sismember: "sIsMember",
  zadd: "zAdd", zrem: "zRem", zrange: "zRange", zscore: "zScore",
};
function wrapPipeline(pipeline: any): any {
  const proxy: any = new Proxy(pipeline, {
    get(target, property: string) {
      const command = redisUrl ? (chainAliases[property] ?? property) : property;
      const value = target[command];
      if (typeof value !== "function") return value;
      return (...args: any[]) => {
        const result = value.apply(target, args);
        // node-redis's multi commands return `this` for chaining (e.g.
        // multi.hSet(...).expire(...)) — re-wrap so chained calls also
        // get case-normalized instead of falling back to the raw object.
        return result === target ? proxy : result;
      };
    },
  });
  return proxy;
}
export const redis: any = new Proxy(client as any, {
  get(target, property: string) {
    if (property === "pipeline") {
      const command = redisUrl ? "multi" : "pipeline";
      return () => wrapPipeline((target as any)[command].call(target));
    }
    const command = commandAliases[property] ?? property;
    const value = target[command];
    if (typeof value !== "function") return value;
    return (...args: any[]) => value.apply(target, args);
  },
});

export async function connectRedis(): Promise<void> {
  if (redisUrl) {
    const tcp = client as RedisClientType;
    if (!tcp.isOpen) await tcp.connect();
    await tcp.ping();
  } else {
    await (client as Redis).ping();
  }
}

export async function closeRedis(): Promise<void> {
  if (redisUrl) {
    const tcp = client as RedisClientType;
    if (tcp.isOpen) await tcp.quit();
  }
}

const LOCK_TTL_SECONDS = 5;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_WAIT_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await (client as any).get(key);

    if (raw === null || raw === undefined) return null;

    // node-redis returns strings; Upstash REST can return already-parsed
    // values. Support both backends without double-parsing objects.
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    }

    return raw as T;
  } catch (error) {
    console.error(`[redis] GET failed for ${key}:`, error);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);

    if (redisUrl) {
      await (client as any).set(key, serialized, { EX: ttlSeconds });
    } else {
      await (client as any).set(key, serialized, { ex: ttlSeconds });
    }
  } catch (error) {
    console.error(`[redis] SET failed for ${key}:`, error);
  }
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
