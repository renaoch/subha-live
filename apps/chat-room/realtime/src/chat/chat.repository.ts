import type pg from 'pg'
import type { ChatMessage, Cursor } from './chat.types.js'
import { metrics } from '../infrastructure/metrics.js'

export class ChatRepository {
  constructor(private readonly pool: pg.Pool) {}

  async history(roomId: string, before: Cursor | undefined, limit: number): Promise<ChatMessage[]> {
    const start = Date.now()
    const params: unknown[] = [roomId, limit]
    let where = 'room_id = $1'
    if (before) {
      params.push(new Date(before.createdAt), before.id)
      where += ' AND (created_at, id) < ($3, $4)'
    }
    const result = await this.pool.query(
      `SELECT id, room_id AS "roomId", user_id AS "userId", username, message,
              EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
       FROM chat_messages
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      params
    )
    metrics.postgresLatencyMs.record(Date.now() - start)
    return result.rows.map((row) => ({ ...row, createdAt: Number(row.createdAt) }))
  }

  async range(roomId: string, startMs: number, endMs: number): Promise<ChatMessage[]> {
    const result = await this.pool.query(
      `SELECT id, room_id AS "roomId", user_id AS "userId", username, message,
              EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
       FROM chat_messages
       WHERE room_id = $1 AND created_at >= to_timestamp($2 / 1000.0) AND created_at <= to_timestamp($3 / 1000.0)
       ORDER BY created_at ASC, id ASC`,
      [roomId, startMs, endMs]
    )
    return result.rows.map((row) => ({ ...row, createdAt: Number(row.createdAt) }))
  }

  /** Idempotent batched insert. Safe to retry: duplicate message IDs are silently skipped. */
  async persistBatch(messages: ChatMessage[]): Promise<void> {
    if (!messages.length) return
    const start = Date.now()
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const values: string[] = []
      const params: unknown[] = []
      messages.forEach((message, index) => {
        const offset = index * 6
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, to_timestamp($${offset + 6} / 1000.0))`)
        params.push(message.id, message.roomId, message.userId, message.username, message.message, message.createdAt)
      })
      await client.query(
        `INSERT INTO chat_messages (id, room_id, user_id, username, message, created_at)
         VALUES ${values.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        params
      )
      await client.query('COMMIT')
      metrics.postgresLatencyMs.record(Date.now() - start)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1')
  }
}
