type Row = { id: string; room_id: string; user_id: string; username: string; message: string; created_at: Date }

export class FakePgPool {
  rows: Row[] = []
  queryLog: string[] = []

  async query(text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    this.queryLog.push(text)

    if (text.includes('SELECT 1')) return { rows: [] }

    if (text.startsWith('BEGIN') || text.startsWith('COMMIT') || text.startsWith('ROLLBACK')) return { rows: [] }

    if (text.includes('INSERT INTO chat_messages')) {
      // params come in groups of 6: id, room_id, user_id, username, message, created_at(ms)
      for (let i = 0; i < params.length; i += 6) {
        const [id, roomId, userId, username, message, createdAtMs] = params.slice(i, i + 6) as [string, string, string, string, string, number]
        if (this.rows.some((r) => r.id === id)) continue // ON CONFLICT DO NOTHING
        this.rows.push({ id, room_id: roomId, user_id: userId, username, message, created_at: new Date(createdAtMs) })
      }
      return { rows: [] }
    }

    if (text.includes('ORDER BY created_at DESC')) {
      const [roomId, limit, beforeDate, beforeId] = params as [string, number, Date?, string?]
      let matches = this.rows.filter((r) => r.room_id === roomId)
      if (beforeDate) {
        matches = matches.filter((r) => r.created_at.getTime() < beforeDate.getTime() || (r.created_at.getTime() === beforeDate.getTime() && r.id < (beforeId as string)))
      }
      matches.sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
      return { rows: matches.slice(0, limit).map(toRow) }
    }

    if (text.includes('ORDER BY created_at ASC')) {
      const [roomId, startMs, endMs] = params as [string, number, number]
      const matches = this.rows
        .filter((r) => r.room_id === roomId && r.created_at.getTime() >= startMs && r.created_at.getTime() <= endMs)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
      return { rows: matches.map(toRow) }
    }

    throw new Error(`FakePgPool: unhandled query: ${text}`)
  }

  async connect() {
    return {
      query: (text: string, params?: unknown[]) => this.query(text, params),
      release: () => {},
    }
  }
}

function toRow(r: Row) {
  return {
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    username: r.username,
    message: r.message,
    createdAt: r.created_at.getTime(),
  }
}
