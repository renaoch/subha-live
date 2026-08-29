import { describe, expect, it } from 'vitest'
import { FakePgPool } from './fakes/fakePgPool.js'
import { ChatRepository } from '../src/chat/chat.repository.js'
import type { ChatMessage } from '../src/chat/chat.types.js'

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: 'm', roomId: 'room1', userId: 'u1', username: 'Renao', message: 'hi', createdAt: 0, ...overrides }
}

describe('ChatRepository', () => {
  it('persists a batch in a single INSERT statement (one round trip)', async () => {
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const messages = Array.from({ length: 500 }, (_, i) => msg({ id: `m${i}`, createdAt: i }))

    await repo.persistBatch(messages)

    const insertQueries = pool.queryLog.filter((q) => q.includes('INSERT INTO chat_messages'))
    expect(insertQueries).toHaveLength(1)
    expect(pool.rows).toHaveLength(500)
  })

  it('is idempotent: re-persisting the same batch does not duplicate rows', async () => {
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    const messages = [msg({ id: 'dup1', createdAt: 1 }), msg({ id: 'dup2', createdAt: 2 })]

    await repo.persistBatch(messages)
    await repo.persistBatch(messages) // simulate a worker retry after a crash before ack

    expect(pool.rows).toHaveLength(2)
  })

  it('history orders strictly by (created_at, id) descending, not by created_at alone', async () => {
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    // Two messages with the identical timestamp - id must be the tiebreaker.
    await repo.persistBatch([
      msg({ id: 'a', createdAt: 1000 }),
      msg({ id: 'b', createdAt: 1000 }),
      msg({ id: 'c', createdAt: 2000 }),
    ])

    const page = await repo.history('room1', undefined, 10)
    expect(page.map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('cursor pagination continues correctly using both created_at and id', async () => {
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    await repo.persistBatch([
      msg({ id: 'a', createdAt: 1000 }),
      msg({ id: 'b', createdAt: 1000 }),
      msg({ id: 'c', createdAt: 2000 }),
    ])

    const firstPage = await repo.history('room1', undefined, 1) // -> c
    expect(firstPage.map((m) => m.id)).toEqual(['c'])

    const secondPage = await repo.history('room1', { createdAt: firstPage[0].createdAt, id: firstPage[0].id }, 1) // -> b
    expect(secondPage.map((m) => m.id)).toEqual(['b'])

    const thirdPage = await repo.history('room1', { createdAt: secondPage[0].createdAt, id: secondPage[0].id }, 1) // -> a
    expect(thirdPage.map((m) => m.id)).toEqual(['a'])
  })

  it('bounded limit never returns more rows than requested', async () => {
    const pool = new FakePgPool()
    const repo = new ChatRepository(pool as any)
    await repo.persistBatch(Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}`, createdAt: i })))
    const page = await repo.history('room1', undefined, 5)
    expect(page).toHaveLength(5)
  })
})
