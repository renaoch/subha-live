# Live Room Realtime (Chat) Service

A standalone, horizontally-scalable backend service for realtime chat: Fastify + WebSocket + Redis + PostgreSQL, authenticated against the existing Supabase project and authorized through the existing Core API. This service owns no users/rooms/membership/permission data — it is a backend-only addition and does not touch the existing Next.js frontend.

## Architecture

```
Client
  │
  ▼
Fastify WebSocket  (/ws/rooms/:roomId/chat)
  │
  ▼
Supabase JWT authentication  (JWKS, with HS256 shared-secret fallback)
  │
  ▼
Core API authorization  (via adapter, cached briefly in Redis)
  │
  ▼
Zod validation → rate limiting → canonical message
  │
  ├──► Redis hot-history bucket (Redis Stream, ~5-minute windows)
  ├──► Redis Stream (durability pipeline)
  └──► Redis Pub/Sub ──► other Realtime instances ──► their WebSockets
```

Persistence (async, off the live-chat path):

```
Redis Stream → consumer group (XREADGROUP) → batch → Postgres transaction
  → COMMIT → XACK
```

History (`GET /rooms/:roomId/chat/history`):

```
Authenticate → Authorize → hot Redis buckets (hit: return)
                              │ (miss)
                              ▼
                    single-flight lock → Postgres → cache result → return
```

## Directory layout

```
backend/realtime/
├── src/
│   ├── chat/
│   │   ├── chat.gateway.ts        Fastify routes: /health, /ready, /metrics, history, websocket
│   │   ├── chat.service.ts        authorization, canonical message pipeline, history lookup
│   │   ├── chat.types.ts
│   │   ├── chat.validation.ts
│   │   ├── chat.repository.ts     Postgres access (durable source of truth)
│   │   ├── websocket/connection.ts  per-connection auth → authorize → register ordering
│   │   ├── redis/                 keys, hot-history buckets, pub/sub, locks, rate limiting, stream
│   │   ├── authorization/         Core API adapter + Redis authorization cache
│   │   └── moderation/gift.ts     future-compatible gift_event routing stub (no economy logic)
│   ├── workers/chat-persistence.worker.ts
│   ├── infrastructure/            config, logger, redis/postgres clients, Supabase JWT verification, metrics
│   └── server.ts                  bootstrap + graceful shutdown
├── migrations/
│   ├── 001_create_chat_messages.sql
│   └── migrate.ts                 minimal migration runner (tracks applied migrations)
├── tests/                         vitest unit/integration tests (in-memory Redis/Postgres fakes)
├── load-test/loadtest.mjs         configurable load-test harness
├── package.json
├── tsconfig.json
└── .env.example
```

## Install

```bash
cd backend/realtime
npm install
```

## Configure

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL` — your existing Supabase Postgres connection string.
- `REDIS_URL` — Redis 7+.
- `SUPABASE_URL` — used both to verify JWTs (via JWKS) and as a config default.
- `CORE_API_BASE_URL`, `CORE_API_AUTH_ENDPOINT`, `CORE_API_PROFILE_ENDPOINT` — your existing Core API.

Optional:
- `SUPABASE_JWT_SECRET` — only needed if your Supabase project still signs tokens with a legacy shared HS256 secret. Modern Supabase projects sign with asymmetric keys (ES256/RS256) discoverable via JWKS, which this service tries first automatically; leave this blank in that case.
- Everything under "Chat configuration" in `.env.example` (message length, rate limits, history limits, hot-history retention/bucket size, persistence batching, auth cache TTL, lock TTL) — all configurable, none hard-coded.

## Run migrations

```bash
npm run migrate
```

This creates the single Chat-owned table, `chat_messages`, and a small `schema_migrations` tracking table. It does **not** create or duplicate any users/rooms/membership/permission tables — those remain owned by Core API / existing Supabase Postgres.

## Development

```bash
npm run dev
```

## Build / typecheck / start

```bash
npm run typecheck
npm run build
npm start
```

## Tests

```bash
npm test
```

79 tests across authentication (JWKS + HS256 fallback, expiry/issuer/audience checks), message validation, authorization (allowed/denied/host/moderator/muted/banned, Core API unavailable, caching + invalidation), Redis (hot-history buckets, pub/sub, locks, rate limiting, streams), history (Redis hit/miss/Postgres fallback, cursor pagination, bounded limits), cache-stampede protection (hundreds of concurrent identical requests trigger exactly one Postgres query), distributed lock ownership/safety, persistence (batch insert, retry, restart-safety, dedup, ack-only-after-commit), and WebSocket connection ordering (authorization must complete before the socket is ever registered to receive room broadcasts).

These use in-memory fakes for Redis and Postgres (no external services required to run `npm test`), but the same logic has also been verified against real Redis 7 and PostgreSQL 16 instances end-to-end (WebSocket connect → auth → authorize → message → hot bucket → stream → persistence worker → Postgres → history API), including a live 100-request cache-stampede test against the same historical bucket that resulted in exactly one Postgres query.

## Load test

```bash
REALTIME_URL=ws://localhost:3002 \
HISTORY_URL=http://localhost:3002 \
SUPABASE_JWT_SECRET=<your-local/staging-shared-secret> \
SUPABASE_URL=<your-supabase-url> \
ROOMS=100 USERS_PER_ROOM=1000 MESSAGES_PER_USER=20 \
HISTORY_STAMPEDE_REQUESTS=600 HISTORY_ROOM=some-room-id \
npm run load-test
```

- If `SUPABASE_JWT_SECRET` is set (only ever do this against a local/staging deployment you control, never production), the harness mints a distinct token per simulated user so concurrent-user scenarios exercise real per-user rate limits instead of all sharing one identity.
- Otherwise, set `SUPABASE_ACCESS_TOKEN` to a single real token; note that every simulated connection will then share that one user's identity and rate limits, understating true concurrent-user capacity — fine for a quick smoke test, not for a real capacity claim.
- Reports: connections, messages sent/received/dropped, messages/sec, history requests/sec, p50/p95/p99 latency for both WebSocket round-trips and history requests, and connection/history error counts.
- Suggested scenarios per the requirements: 100 rooms × 1,000 users/room; 500 rooms × 1,000 users/room; single room at high message rate; 600 simultaneous history requests for the same historical bucket (`HISTORY_STAMPEDE_REQUESTS=600`); repeat against multiple Realtime instances behind your load balancer by pointing `REALTIME_URL`/`HISTORY_URL` at it.
- Server-side metrics (Redis/Postgres latency, cache hit rate, persistence lag/queue depth, etc.) are available at `GET /metrics` on each instance during the run.

Don't claim a specific scale is supported until a load test has actually demonstrated it at that scale.

## Exposed endpoints

**HTTP**
- `GET /health` — process liveness.
- `GET /ready` — checks Redis and Postgres; 503 if either is unavailable.
- `GET /metrics` — JSON snapshot of connection counts, message throughput, cache hit rate, Postgres/Redis latency percentiles, persistence lag, lock contention, and rate-limit rejections. Scrape this into your existing observability stack.
- `GET /rooms/:roomId/chat/history?before=<cursor>&limit=<n>` — requires `Authorization: Bearer <supabase JWT>` (or `?token=`); cursor-paginated, bounded by `CHAT_HISTORY_MAX_LIMIT`.

**WebSocket**
- `WS /ws/rooms/:roomId/chat` — pass the Supabase JWT as `?token=` (or `Authorization: Bearer`) in the connection request.
  - On success, the server sends `{"type":"connected","userId":...,"username":...}` once authorization completes — wait for this before sending, since the server does not attach a message listener (and therefore cannot process it) until authorization has finished.
  - Client → server: `{"type":"chat_message","message":"..."}`. All other fields (id, roomId, userId, username, createdAt) are server-owned and any client-supplied values are ignored.
  - Server → client: the canonical message object, or `{"type":"error","code":...,"message":...}` on rate limiting, mute, invalid payload, or auth/authorization failure.

## Dependencies

- **Redis 7+**: hot-history buckets, pub/sub fanout, distributed locks, rate limiting, the persistence stream/consumer group, and the authorization cache.
- **PostgreSQL** (existing Supabase Postgres): durable storage for `chat_messages` only.
- **Core API**: the existing service, reached through the isolated adapter in `src/chat/authorization/coreApiAdapter.ts`. Its endpoint paths are configurable via `CORE_API_AUTH_ENDPOINT` / `CORE_API_PROFILE_ENDPOINT` so its contract can evolve without touching the rest of Chat.
- **Supabase Authentication**: JWTs are verified against the project's JWKS endpoint by default, falling back to a shared HS256 secret only if `SUPABASE_JWT_SECRET` is configured (for projects that haven't migrated to asymmetric signing).

## Notes on specific design decisions

- **Hot history** is stored as Redis Streams per ~5-minute bucket (`chat:room:{roomId}:bucket:{bucketStart}`), written with `XADD` and read with `XRANGE` — the same data structure for both operations, unlike the previous `RPUSH`/`MGET` mismatch.
- **Cache stampede protection** on the history-miss path uses a Redis-token-owned lock plus a short-lived result cache: the lock owner queries Postgres once and writes the result; every other concurrent caller polls the result cache (not Postgres) until it's populated or the lock expires.
- **Distributed lock release** is a Lua compare-and-delete keyed on a random token per acquisition, so a request can never release a lock it doesn't own.
- **Rate limiting** is an atomic Redis Lua token-bucket (burst capacity + steady refill rate), not a fixed-window counter.
- **Persistence** uses a real Redis Streams consumer group (`XGROUP`/`XREADGROUP`/`XACK`), reclaims entries abandoned by a crashed consumer (`XAUTOCLAIM`), and only trims the stream up to the oldest still-pending entry (falling back to an approximate `MAXLEN` trim only when there is no pending backlog) — so unprocessed messages are never trimmed away before the worker persists them.
- **WebSocket authorization ordering**: the socket is registered to receive room broadcasts only after Supabase JWT authentication and Core API authorization both succeed. It also does not receive `chat_message` input handling until that point, so the server sends an explicit `{"type":"connected"}` acknowledgment the client should wait for before sending its first message.
- **No duplicate tables**: the only Chat-owned table is `chat_messages`. Everything about users, rooms, membership, and permissions is resolved from Core API through the adapter and cached briefly (default 30s, configurable) in Redis.
- **Gift events**: `src/chat/moderation/gift.ts` only recognizes and can route an externally-produced `gift_event` payload for future compatibility with an Economy service. No coins, wallets, purchases, or balance changes are implemented or touched anywhere in this service.
