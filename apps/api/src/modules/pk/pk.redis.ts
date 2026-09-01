// Redis access for PK battles (Core API side). The live scoreboard lives in
// Redis; the atomic Lua scripts below are what guarantee correctness under
// concurrent gifts and finalization. Never read-modify-write outside a script.

import { redis } from "../../lib/redis";
import { PK_FINISHED_RETENTION_SECONDS, type PkRedisState, type PkSide, type PkStatus } from "./pk.types";

export const pkKeys = {
  state: (battleId: string) => `pk:${battleId}:state`,
  gifts: (battleId: string) => `pk:${battleId}:gifts`,
  lock: (battleId: string) => `pk:${battleId}:lock`,
  activeSet: () => "pk:active",
  host: (hostId: string) => `pk:host:${hostId}`,
};

const scoreField = (side: PkSide) => (side === "A" ? "scoreA" : "scoreB");

// ---------------------------------------------------------------------------
// Atomic score increment + gift idempotency, in a single Lua script.
// Returns [scoreA, scoreB, version]; raises PK_NOT_ACTIVE / PK_DUPLICATE_GIFT.
// ---------------------------------------------------------------------------
const ADD_SCORE_SCRIPT = `
local status = redis.call("HGET", KEYS[1], "status")
if status ~= "ACTIVE" then
  return redis.error_reply("PK_NOT_ACTIVE")
end
local added = redis.call("SADD", KEYS[2], ARGV[1])
if added == 0 then
  return redis.error_reply("PK_DUPLICATE_GIFT")
end
local field = ARGV[2]
local otherField = (ARGV[2] == "scoreA") and "scoreB" or "scoreA"
local newScore = redis.call("HINCRBY", KEYS[1], field, ARGV[3])
local newVersion = redis.call("HINCRBY", KEYS[1], "version", 1)
local otherScore = redis.call("HGET", KEYS[1], otherField) or "0"
if field == "scoreA" then
  return { tonumber(newScore), tonumber(otherScore), tonumber(newVersion) }
else
  return { tonumber(otherScore), tonumber(newScore), tonumber(newVersion) }
end
`;

// Claim both hosts atomically (rejects if either is already in a PK).
const CLAIM_HOSTS_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 1 then return 0 end
if redis.call("EXISTS", KEYS[2]) == 1 then return 0 end
redis.call("SET", KEYS[1], ARGV[1])
redis.call("SET", KEYS[2], ARGV[1])
return 1
`;

// Release both hosts only if they still point at this battle.
const RELEASE_HOSTS_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("DEL", KEYS[1]) end
if redis.call("GET", KEYS[2]) == ARGV[1] then redis.call("DEL", KEYS[2]) end
return 1
`;

// Lock acquire (NX) and compare-and-delete release.
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

export const pkRedis = {
  async writeState(battleId: string, state: PkRedisState): Promise<void> {
    const key = pkKeys.state(battleId);
    await redis.hset(key, {
      battleId: state.battleId,
      status: state.status,
      hostA: state.hostA,
      hostB: state.hostB,
      roomA: state.roomA,
      roomB: state.roomB,
      scoreA: String(state.scoreA),
      scoreB: String(state.scoreB),
      startedAt: state.startedAt != null ? String(state.startedAt) : "",
      endsAt: state.endsAt != null ? String(state.endsAt) : "",
      version: String(state.version),
    });
  },

  async readState(battleId: string): Promise<PkRedisState | null> {
    const raw = await redis.hgetall(pkKeys.state(battleId));
    if (!raw || Object.keys(raw).length === 0) return null;
    return {
      battleId: raw.battleId ?? battleId,
      status: (raw.status as PkStatus) ?? "IDLE",
      hostA: raw.hostA ?? "",
      hostB: raw.hostB ?? "",
      roomA: raw.roomA ?? "",
      roomB: raw.roomB ?? "",
      scoreA: toNumber(raw.scoreA),
      scoreB: toNumber(raw.scoreB),
      startedAt: raw.startedAt ? toNumber(raw.startedAt) : null,
      endsAt: raw.endsAt ? toNumber(raw.endsAt) : null,
      version: toNumber(raw.version),
    };
  },

  async setStatus(battleId: string, status: PkStatus): Promise<void> {
    await redis.hset(pkKeys.state(battleId), { status });
  },

  /**
   * Atomically add a gift's score to one side, tied to the gift transaction id
   * for idempotency. Returns the authoritative new scores + version, or
   * `{ added: false }` for a duplicate / non-active battle.
   */
  async addScore(
    battleId: string,
    side: PkSide,
    giftTxId: string,
    delta: number,
  ): Promise<{ added: boolean; scoreA: number; scoreB: number; version: number }> {
    try {
      const result = (await redis.eval(ADD_SCORE_SCRIPT, {
        keys: [pkKeys.state(battleId), pkKeys.gifts(battleId)],
        arguments: [giftTxId, scoreField(side), String(delta)],
      })) as unknown[];
      return {
        added: true,
        scoreA: toNumber(result?.[0]),
        scoreB: toNumber(result?.[1]),
        version: toNumber(result?.[2]),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("PK_DUPLICATE_GIFT")) {
        const state = await this.readState(battleId);
        return {
          added: false,
          scoreA: state?.scoreA ?? 0,
          scoreB: state?.scoreB ?? 0,
          version: state?.version ?? 0,
        };
      }
      // PK_NOT_ACTIVE (or any other failure): do not score.
      return { added: false, scoreA: 0, scoreB: 0, version: 0 };
    }
  },

  /** Resolve a host's currently-active battle id, or null. */
  async getHostBattle(hostId: string): Promise<string | null> {
    const value = (await redis.get(pkKeys.host(hostId))) as string | null | undefined;
    return typeof value === "string" && value.length > 0 ? value : null;
  },

  async claimHosts(battleId: string, hostA: string, hostB: string): Promise<boolean> {
    const result = await redis.eval(CLAIM_HOSTS_SCRIPT, {
      keys: [pkKeys.host(hostA), pkKeys.host(hostB)],
      arguments: [battleId],
    });
    return Number(result) === 1;
  },

  async releaseHosts(battleId: string, hostA: string, hostB: string): Promise<void> {
    await redis.eval(RELEASE_HOSTS_SCRIPT, {
      keys: [pkKeys.host(hostA), pkKeys.host(hostB)],
      arguments: [battleId],
    });
  },

  async markActive(battleId: string): Promise<void> {
    await redis.sadd(pkKeys.activeSet(), battleId);
  },

  async markInactive(battleId: string): Promise<void> {
    await redis.srem(pkKeys.activeSet(), battleId);
  },

  async listActive(): Promise<string[]> {
    return (await redis.smembers(pkKeys.activeSet())) as string[];
  },

  async acquireFinalizeLock(battleId: string, token: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.eval(LOCK_SCRIPT, {
      keys: [pkKeys.lock(battleId)],
      arguments: [token, String(ttlSeconds)],
    });
    return Number(result) === 1;
  },

  async releaseFinalizeLock(battleId: string, token: string): Promise<void> {
    await redis.eval(UNLOCK_SCRIPT, { keys: [pkKeys.lock(battleId)], arguments: [token] });
  },

  /** Short retention on a finished battle; Postgres is the source of truth after this. */
  async expireState(battleId: string): Promise<void> {
    await redis.expire(pkKeys.state(battleId), PK_FINISHED_RETENTION_SECONDS);
    await redis.expire(pkKeys.gifts(battleId), PK_FINISHED_RETENTION_SECONDS);
  },

  async deleteState(battleId: string): Promise<void> {
    await redis.del(pkKeys.state(battleId));
  },
};
