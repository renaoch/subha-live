// Redis access for Lucky Ring rounds. Mirrors modules/quiz/quiz.redis.ts:
// the live phase/timer lives in Redis; Postgres only gets written when money
// actually moves (bet placed, round settled) — see lucky-ring.repository.ts.

import { redis } from "../../lib/redis";
import { LUCKY_RING_REDIS_ACTIVE_TTL_SECONDS } from "./lucky-ring.types";
import type { LuckyRingRedisState, LuckyRingStatus } from "./lucky-ring.types";

export const luckyRingKeys = {
  // One active round per room at a time — keyed by roomId, not roundId, so a
  // client always knows where to look without a discovery round-trip.
  state: (roomId: string) => `lucky_ring:${roomId}:state`,
  lock: (roomId: string) => `lucky_ring:${roomId}:lock`,
  activeSet: () => "lucky_ring:active",
};

const LOCK_SCRIPT = `
local ok = redis.call("SET", KEYS[1], ARGV[1], "NX", "EX", ARGV[2])
if ok then return 1 else return 0 end
`;
const UNLOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export const luckyRingRedis = {
  async writeState(roomId: string, state: LuckyRingRedisState): Promise<void> {
    await redis.hset(luckyRingKeys.state(roomId), {
      roundId: state.roundId,
      roomId: state.roomId,
      roundNumber: String(state.roundNumber),
      status: state.status,
      phaseEndsAt: state.phaseEndsAt != null ? String(state.phaseEndsAt) : "",
      winningCell: state.winningCell != null ? String(state.winningCell) : "",
      configVersion: String(state.configVersion),
      version: String(state.version),
    });
    await redis.expire(luckyRingKeys.state(roomId), LUCKY_RING_REDIS_ACTIVE_TTL_SECONDS);
  },

  async readState(roomId: string): Promise<LuckyRingRedisState | null> {
    const raw = await redis.hgetall(luckyRingKeys.state(roomId));
    if (!raw || Object.keys(raw).length === 0) return null;
    return {
      roundId: raw.roundId ?? "",
      roomId: raw.roomId ?? roomId,
      roundNumber: toNumber(raw.roundNumber),
      status: (raw.status as LuckyRingStatus) ?? "BETTING",
      phaseEndsAt: raw.phaseEndsAt ? toNumber(raw.phaseEndsAt) : null,
      winningCell: raw.winningCell ? toNumber(raw.winningCell) : null,
      configVersion: toNumber(raw.configVersion),
      version: toNumber(raw.version),
    };
  },

  async setPhase(
    roomId: string,
    status: LuckyRingStatus,
    phaseEndsAt: number | null,
    winningCell: number | null,
  ): Promise<void> {
    await redis.hset(luckyRingKeys.state(roomId), {
      status,
      phaseEndsAt: phaseEndsAt != null ? String(phaseEndsAt) : "",
      winningCell: winningCell != null ? String(winningCell) : "",
    });
    await redis.expire(luckyRingKeys.state(roomId), LUCKY_RING_REDIS_ACTIVE_TTL_SECONDS);
  },

  async markActive(roomId: string): Promise<void> {
    await redis.sadd(luckyRingKeys.activeSet(), roomId);
  },

  async markInactive(roomId: string): Promise<void> {
    await redis.srem(luckyRingKeys.activeSet(), roomId);
  },

  async listActive(): Promise<string[]> {
    return (await redis.smembers(luckyRingKeys.activeSet())) as string[];
  },

  async acquireLock(roomId: string, token: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.eval(LOCK_SCRIPT, {
      keys: [luckyRingKeys.lock(roomId)],
      arguments: [token, String(ttlSeconds)],
    });
    return Number(result) === 1;
  },

  async releaseLock(roomId: string, token: string): Promise<void> {
    await redis.eval(UNLOCK_SCRIPT, { keys: [luckyRingKeys.lock(roomId)], arguments: [token] });
  },
};