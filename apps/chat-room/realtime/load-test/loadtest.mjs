// Configurable load-test harness for the Realtime chat service.
//
// Usage:
//   REALTIME_URL=ws://localhost:3002 \
//   HISTORY_URL=http://localhost:3002 \
//   SUPABASE_ACCESS_TOKEN=<a valid supabase jwt> \
//   ROOMS=100 USERS_PER_ROOM=1000 MESSAGES_PER_USER=20 \
//   node load-test/loadtest.mjs
//
// All parameters are configurable via environment variables so the same
// harness can drive the required scenarios (100 rooms x 1,000 users/room,
// 500 rooms x 1,000 users/room, single room high message rate, 600
// simultaneous history requests for the same historical bucket, multiple
// Realtime instances behind REALTIME_URL/HISTORY_URL load balancing).

import WebSocket from 'ws'
import { SignJWT } from 'jose'

const wsBase = process.env.REALTIME_URL ?? 'ws://localhost:3002'
const httpBase = process.env.HISTORY_URL ?? 'http://localhost:3002'
const staticToken = process.env.SUPABASE_ACCESS_TOKEN ?? ''
// For load testing against a local/staging deployment where the HS256
// shared secret is known, set SUPABASE_JWT_SECRET so the harness can mint a
// distinct token per simulated user. Reusing one real user's token for every
// simulated connection makes them all share the same per-user rate limits
// and understates real concurrent-user capacity - never do this in
// production, only for local/staging load tests you control.
const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? ''
const jwtIssuer = process.env.SUPABASE_JWT_ISSUER ?? `${process.env.SUPABASE_URL ?? 'https://example.supabase.co'}/auth/v1`

const rooms = Number(process.env.ROOMS ?? 1)
const usersPerRoom = Number(process.env.USERS_PER_ROOM ?? 25)
const messagesPerUser = Number(process.env.MESSAGES_PER_USER ?? 20)
const connectTimeoutMs = Number(process.env.CONNECT_TIMEOUT_MS ?? 10000)
const testDurationMs = Number(process.env.TEST_DURATION_MS ?? 15000)
const historyStampedeRequests = Number(process.env.HISTORY_STAMPEDE_REQUESTS ?? 0)
const historyRoom = process.env.HISTORY_ROOM ?? 'load-test-room-0'
const roomPrefix = process.env.ROOM_PREFIX ?? 'load-test-room'

if (!staticToken && !jwtSecret) {
  console.error('Either SUPABASE_ACCESS_TOKEN or SUPABASE_JWT_SECRET is required to run the load test.')
  process.exit(1)
}
if (!jwtSecret) {
  console.warn('WARNING: no SUPABASE_JWT_SECRET set - every simulated connection will share one identity and one set of per-user rate limits, understating real capacity.')
}

let tokenCounter = 0
async function tokenForNewUser() {
  if (!jwtSecret) return staticToken
  const sub = `load-test-user-${tokenCounter++}`
  const key = new TextEncoder().encode(jwtSecret)
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(jwtIssuer)
    .setAudience('authenticated')
    .setExpirationTime('2h')
    .sign(key)
}

class Percentiles {
  constructor() {
    this.samples = []
  }
  record(ms) {
    this.samples.push(ms)
  }
  compute() {
    if (!this.samples.length) return { p50: 0, p95: 0, p99: 0, count: 0 }
    const sorted = [...this.samples].sort((a, b) => a - b)
    const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
    return { p50: at(50), p95: at(95), p99: at(99), count: sorted.length }
  }
}

const metrics = {
  connections: 0,
  connectionFailures: 0,
  messagesSent: 0,
  messagesReceived: 0,
  droppedMessages: 0,
  wsLatency: new Percentiles(),
  historyRequests: 0,
  historyErrors: 0,
  historyLatency: new Percentiles(),
}

function connectClient(roomId, token) {
  return new Promise((resolve) => {
    const start = Date.now()
    const ws = new WebSocket(`${wsBase}/ws/rooms/${roomId}/chat?token=${encodeURIComponent(token)}`)
    const pending = new Map() // correlationId -> sentAt, for round-trip latency
    let ready = false
    const readyWaiters = []

    const timeout = setTimeout(() => {
      metrics.connectionFailures++
      try {
        ws.terminate()
      } catch {}
      resolve(null)
    }, connectTimeoutMs)

    ws.on('message', (raw) => {
      metrics.messagesReceived++
      try {
        const parsed = JSON.parse(raw.toString())
        if (parsed.type === 'connected') {
          clearTimeout(timeout)
          ready = true
          for (const resolveWaiter of readyWaiters.splice(0)) resolveWaiter()
          metrics.connections++
          resolve({ ws, roomId, pending, connectLatencyMs: Date.now() - start, waitUntilReady: () => Promise.resolve() })
          return
        }
        if (parsed.type === 'chat_message' && pending.has(parsed.message)) {
          const sentAt = pending.get(parsed.message)
          metrics.wsLatency.record(Date.now() - sentAt)
          pending.delete(parsed.message)
        }
      } catch {
        // ignore non-JSON / unrelated frames
      }
    })

    ws.on('error', () => {
      metrics.connectionFailures++
    })

    ws.on('close', () => {
      for (const [, sentAt] of pending) {
        void sentAt
        metrics.droppedMessages++
      }
    })
  })
}

async function runMessagingScenario() {
  console.log(`Connecting ${rooms} rooms x ${usersPerRoom} users/room = ${rooms * usersPerRoom} connections...`)
  const clients = []
  const connectStart = Date.now()

  for (let r = 0; r < rooms; r++) {
    const roomId = `${roomPrefix}-${r}`
    const roomClients = await Promise.all(
      Array.from({ length: usersPerRoom }, async () => connectClient(roomId, await tokenForNewUser()))
    )
    clients.push(...roomClients.filter(Boolean))
  }
  console.log(`Connected ${clients.length}/${rooms * usersPerRoom} clients in ${Date.now() - connectStart}ms`)

  const sendStart = Date.now()
  await Promise.all(
    clients.map(async (client) => {
      for (let n = 0; n < messagesPerUser; n++) {
        const payload = `load-${client.roomId}-${Math.random().toString(36).slice(2)}-${n}`
        client.pending.set(payload, Date.now())
        client.ws.send(JSON.stringify({ type: 'chat_message', message: payload }))
        metrics.messagesSent++
        await new Promise((r) => setTimeout(r, 1)) // avoid instantaneously tripping per-connection rate limits
      }
    })
  )

  await new Promise((r) => setTimeout(r, Math.max(0, testDurationMs - (Date.now() - sendStart))))
  for (const client of clients) {
    try {
      client.ws.close()
    } catch {}
  }
}

async function fetchHistory(roomId) {
  const start = Date.now()
  metrics.historyRequests++
  const token = await tokenForNewUser()
  try {
    const response = await fetch(`${httpBase}/rooms/${roomId}/chat/history?limit=50`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!response.ok) metrics.historyErrors++
    await response.json()
  } catch {
    metrics.historyErrors++
  } finally {
    metrics.historyLatency.record(Date.now() - start)
  }
}

async function runHistoryStampedeScenario() {
  if (!historyStampedeRequests) return
  console.log(`Firing ${historyStampedeRequests} simultaneous history requests for room "${historyRoom}"...`)
  await Promise.all(Array.from({ length: historyStampedeRequests }, () => fetchHistory(historyRoom)))
}

async function main() {
  const overallStart = Date.now()
  await Promise.all([runMessagingScenario(), runHistoryStampedeScenario()])
  const durationSeconds = (Date.now() - overallStart) / 1000

  const report = {
    scenario: { rooms, usersPerRoom, messagesPerUser, historyStampedeRequests },
    connections: metrics.connections,
    connectionFailures: metrics.connectionFailures,
    messagesSent: metrics.messagesSent,
    messagesReceived: metrics.messagesReceived,
    droppedMessages: metrics.droppedMessages,
    messagesPerSecond: Number((metrics.messagesSent / durationSeconds).toFixed(2)),
    wsLatencyMs: metrics.wsLatency.compute(),
    historyRequests: metrics.historyRequests,
    historyErrors: metrics.historyErrors,
    historyRequestsPerSecond: Number((metrics.historyRequests / durationSeconds).toFixed(2)),
    historyLatencyMs: metrics.historyLatency.compute(),
    durationSeconds,
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
