import { describe, expect, it } from 'vitest'
import { readBattleState, stateSyncEvent } from '../src/pk/pk.state.js'

function fakeRedis(hash: Record<string, string> | null) {
  return { hgetall: async () => hash } as any
}

describe('readBattleState', () => {
  it('returns null when the hash is absent or empty', async () => {
    expect(await readBattleState(fakeRedis(null), 'b1')).toBeNull()
    expect(await readBattleState(fakeRedis({}), 'b1')).toBeNull()
  })

  it('parses a full state hash with numeric coercion', async () => {
    const state = await readBattleState(
      fakeRedis({
        battleId: 'b1',
        status: 'ACTIVE',
        hostA: 'hostA',
        hostB: 'hostB',
        roomA: 'roomA',
        roomB: 'roomB',
        scoreA: '12500',
        scoreB: '9800',
        startedAt: '123456',
        endsAt: '123999',
        version: '183',
      }),
      'b1',
    )
    expect(state).toEqual({
      battleId: 'b1',
      status: 'ACTIVE',
      hostA: 'hostA',
      hostB: 'hostB',
      roomA: 'roomA',
      roomB: 'roomB',
      scoreA: 12500,
      scoreB: 9800,
      startedAt: 123456,
      endsAt: 123999,
      version: 183,
    })
  })

  it('treats empty timestamps as null', async () => {
    const state = await readBattleState(fakeRedis({ status: 'STARTING', startedAt: '', endsAt: '' }), 'b1')
    expect(state?.startedAt).toBeNull()
    expect(state?.endsAt).toBeNull()
  })
})

describe('stateSyncEvent', () => {
  it('emits the PK_STATE_SYNC shape a client needs', () => {
    const event = stateSyncEvent({
      battleId: 'b1',
      status: 'ACTIVE',
      hostA: 'hA',
      hostB: 'hB',
      roomA: 'rA',
      roomB: 'rB',
      scoreA: 1,
      scoreB: 2,
      startedAt: 3,
      endsAt: 4,
      version: 5,
    })
    expect(event.type).toBe('PK_STATE_SYNC')
    expect(event.battleId).toBe('b1')
    expect(event.status).toBe('ACTIVE')
    expect(event.hostA).toBe('hA')
    expect(event.hostB).toBe('hB')
    expect(event.scoreA).toBe(1)
    expect(event.scoreB).toBe(2)
    expect(event.startedAt).toBe(3)
    expect(event.endsAt).toBe(4)
    expect(event.version).toBe(5)
  })
})
