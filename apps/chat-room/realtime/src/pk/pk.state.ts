import type Redis from 'ioredis'
import { pkKeys } from './pk.keys.js'
import type { PkHotState, PkStatus } from './pk.types.js'

function toNumber(value: unknown): number {
  return Number(value ?? 0)
}

/** Read a battle's hot state from Redis. Returns null if not present. */
export async function readBattleState(redis: Redis, battleId: string): Promise<PkHotState | null> {
  const raw = await redis.hgetall(pkKeys.state(battleId))
  if (!raw || Object.keys(raw).length === 0) return null
  return {
    battleId: raw.battleId ?? battleId,
    status: (raw.status as PkStatus) ?? 'IDLE',
    hostA: raw.hostA ?? '',
    hostB: raw.hostB ?? '',
    roomA: raw.roomA ?? '',
    roomB: raw.roomB ?? '',
    scoreA: toNumber(raw.scoreA),
    scoreB: toNumber(raw.scoreB),
    startedAt: raw.startedAt ? toNumber(raw.startedAt) : null,
    endsAt: raw.endsAt ? toNumber(raw.endsAt) : null,
    version: toNumber(raw.version),
  }
}

/** Shape of the PK_STATE_SYNC event sent to a client that just joined. */
export function stateSyncEvent(state: PkHotState) {
  return {
    type: 'PK_STATE_SYNC',
    battleId: state.battleId,
    status: state.status,
    hostA: state.hostA,
    hostB: state.hostB,
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    version: state.version,
    ts: Date.now(),
  }
}
