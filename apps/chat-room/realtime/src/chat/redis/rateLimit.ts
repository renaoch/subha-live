import type Redis from 'ioredis'

/**
 * Atomic token-bucket limiter implemented as a Lua script so the
 * read-modify-write of tokens/timestamp is a single Redis operation. This
 * gives genuine sliding-window behavior (as opposed to a fixed-window counter
 * that resets to zero at bucket boundaries and lets bursts through around the
 * edges).
 *
 * capacity: max tokens (i.e. max burst size)
 * refillPerSecond: tokens added back per second (i.e. sustained rate)
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSecond = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local data = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsedSeconds = math.max(0, (now - ts) / 1000)
tokens = math.min(capacity, tokens + elapsedSeconds * refillPerSecond)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call("HMSET", key, "tokens", tokens, "ts", now)
redis.call("EXPIRE", key, ttl)

return allowed
`

export async function allowTokenBucket(
  redis: Redis,
  key: string,
  capacity: number,
  refillPerSecond: number,
  cost = 1,
  ttlSeconds = 60
): Promise<boolean> {
  const result = await redis.eval(TOKEN_BUCKET_SCRIPT, 1, key, capacity, refillPerSecond, Date.now(), cost, ttlSeconds)
  return Number(result) === 1
}
