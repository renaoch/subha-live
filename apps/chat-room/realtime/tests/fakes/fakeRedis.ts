type StreamEntry = [string, string[]]

/**
 * Minimal in-memory stand-in for the ioredis client, covering exactly the
 * commands this service issues (strings, TTL, hashes, streams with a single
 * consumer group, EVAL for the two Lua scripts, pub/sub is a no-op here).
 * This lets unit tests exercise real logic (lock ownership, token bucket
 * math, bucket read/write, stampede single-flight, consumer-group ack flow)
 * without a live Redis server.
 */
export class FakeRedis {
  private strings = new Map<string, { value: string; expiresAt: number | null }>()
  private hashes = new Map<string, Record<string, string>>()
  private streams = new Map<string, StreamEntry[]>()
  private groups = new Map<string, Map<string, { pending: Map<string, { consumer: string; deliveredAt: number }>; delivered: Set<string> }>>()
  private seq = 0

  private now() {
    return Date.now()
  }

  private isExpired(key: string): boolean {
    const entry = this.strings.get(key)
    if (!entry) return true
    if (entry.expiresAt !== null && entry.expiresAt < this.now()) {
      this.strings.delete(key)
      return true
    }
    return false
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null
    return this.strings.get(key)?.value ?? null
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
    const flat = args.flat()
    let ex: number | null = null
    let nx = false
    for (let i = 0; i < flat.length; i++) {
      if (flat[i] === 'EX') ex = Number(flat[i + 1])
      if (flat[i] === 'NX') nx = true
    }
    if (nx && !this.isExpired(key) && this.strings.has(key)) return null
    this.strings.set(key, { value, expiresAt: ex ? this.now() + ex * 1000 : null })
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0
    for (const key of keys) {
      if (this.strings.delete(key)) count++
      if (this.hashes.delete(key)) count++
    }
    return count
  }

  async exists(key: string): Promise<number> {
    if (this.streams.has(key) && (this.streams.get(key)?.length ?? 0) > 0) return 1
    if (this.isExpired(key)) return 0
    return this.strings.has(key) ? 1 : 0
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0') + 1
    await this.set(key, String(current))
    return current
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return [...this.strings.keys()].filter((k) => regex.test(k))
  }

  async hmset_(key: string, fields: Record<string, string>) {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...fields })
  }

  publish = async (_channel: string, _payload: string) => 0
  psubscribe = async (_pattern: string) => {}
  on = (_event: string, _cb: (...args: unknown[]) => void) => {}

  /** Supports the two Lua scripts used by the service: lock release, token bucket. */
  async eval(script: string, _numKeys: number, ...rest: unknown[]): Promise<unknown> {
    if (script.includes('DEL')) {
      // release lock script
      const [key, token] = rest as [string, string]
      const entry = this.strings.get(key)
      if (entry && entry.value === token) {
        this.strings.delete(key)
        return 1
      }
      return 0
    }
    // token bucket script
    const [key, capacity, refillPerSecond, now, cost, ttl] = rest as [string, number, number, number, number, number]
    void ttl
    const hash = this.hashes.get(key)
    let tokens = hash ? Number(hash.tokens) : Number(capacity)
    let ts = hash ? Number(hash.ts) : Number(now)
    const elapsedSeconds = Math.max(0, (Number(now) - ts) / 1000)
    tokens = Math.min(Number(capacity), tokens + elapsedSeconds * Number(refillPerSecond))
    let allowed = 0
    if (tokens >= Number(cost)) {
      tokens -= Number(cost)
      allowed = 1
    }
    this.hashes.set(key, { tokens: String(tokens), ts: String(now) })
    return allowed
  }

  // ---- Streams ----
  async xadd(key: string, ...rest: unknown[]): Promise<string> {
    // supports both: xadd(key, 'MAXLEN', '~', n, '*', field, value) and xadd(key, '*', field, value)
    // Fields are always the trailing field/value pairs after the id token ('*').
    const starIndex = rest.indexOf('*')
    const fields = (starIndex >= 0 ? rest.slice(starIndex + 1) : rest.slice(1)) as string[]
    const id = `${this.now()}-${this.seq++}`
    const list = this.streams.get(key) ?? []
    list.push([id, fields])
    this.streams.set(key, list)
    return id
  }

  async xrange(key: string, _start: string, _end: string): Promise<StreamEntry[]> {
    return this.streams.get(key) ?? []
  }

  async xgroup(_cmd: string, key: string, group: string, ..._rest: unknown[]): Promise<'OK'> {
    if (!this.streams.has(key)) this.streams.set(key, [])
    const groupsForKey = this.groups.get(key) ?? new Map()
    if (!groupsForKey.has(group)) groupsForKey.set(group, { pending: new Map(), delivered: new Set() })
    this.groups.set(key, groupsForKey)
    return 'OK'
  }

  async xreadgroup(
    _group: string,
    groupName: string,
    consumer: string,
    _count: string,
    count: number,
    _block: string,
    blockMs: number,
    _streamsKw: string,
    key: string,
    _cursor: string
  ): Promise<[string, StreamEntry[]][] | null> {
    const entries = this.streams.get(key) ?? []
    const groupsForKey = this.groups.get(key) ?? new Map()
    const group = groupsForKey.get(groupName) ?? { pending: new Map(), delivered: new Set<string>() }
    groupsForKey.set(groupName, group)
    this.groups.set(key, groupsForKey)

    const delivered: StreamEntry[] = []
    for (const [id, fields] of entries) {
      if (delivered.length >= count) break
      if (group.delivered.has(id)) continue
      group.delivered.add(id)
      group.pending.set(id, { consumer, deliveredAt: this.now() })
      delivered.push([id, fields])
    }
    if (!delivered.length) {
      // Emulate BLOCK by waiting briefly instead of a tight synchronous loop.
      await new Promise((resolve) => setTimeout(resolve, Math.min(blockMs, 20)))
      return null
    }
    return [[key, delivered]]
  }

  async xack(key: string, groupName: string, ...ids: string[]): Promise<number> {
    const group = this.groups.get(key)?.get(groupName)
    if (!group) return 0
    let count = 0
    for (const id of ids) {
      if (group.pending.delete(id)) count++
    }
    return count
  }

  async xautoclaim(key: string, groupName: string, consumer: string, minIdleTimeMs: number, _start: string, ..._rest: unknown[]): Promise<[string, StreamEntry[], string[]]> {
    const group = this.groups.get(key)?.get(groupName)
    const entries = this.streams.get(key) ?? []
    if (!group) return ['0', [], []]
    const claimed: StreamEntry[] = []
    for (const [id, pendingInfo] of group.pending.entries()) {
      if (this.now() - pendingInfo.deliveredAt >= minIdleTimeMs) {
        const entry = entries.find(([entryId]) => entryId === id)
        if (entry) {
          group.pending.set(id, { consumer, deliveredAt: this.now() })
          claimed.push(entry)
        }
      }
    }
    return ['0', claimed, []]
  }

  async xpending(key: string, groupName: string): Promise<[number, string | null, string | null, unknown]> {
    const group = this.groups.get(key)?.get(groupName)
    if (!group || group.pending.size === 0) return [0, null, null, null]
    const ids = [...group.pending.keys()].sort()
    return [group.pending.size, ids[0], ids.at(-1) ?? null, null]
  }

  async xtrim(key: string, mode: string, ...args: unknown[]): Promise<number> {
    const entries = this.streams.get(key) ?? []
    if (mode === 'MINID') {
      const minId = (args[0] as string) ?? '0'
      const kept = entries.filter(([id]) => id >= minId)
      const removed = entries.length - kept.length
      this.streams.set(key, kept)
      return removed
    }
    // MAXLEN ~ n
    const n = Number(args.at(-1))
    const kept = entries.slice(-n)
    const removed = entries.length - kept.length
    this.streams.set(key, kept)
    return removed
  }
}
