import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'
import { logger } from '../infrastructure/logger.js'
import type { Config } from '../infrastructure/config.js'
import { ChatRepository } from '../chat/chat.repository.js'
import { acknowledge, claimStalePendingEntries, ensureConsumerGroup, readPersistenceBatch, trimSafely, type StreamEntry } from '../chat/redis/stream.js'
import { metrics } from '../infrastructure/metrics.js'

const STALE_CLAIM_IDLE_MS = 30_000
const RETRY_BACKOFF_MS = 1000

export class ChatPersistenceWorker {
  private readonly consumerName = `worker-${process.pid}-${randomUUID().slice(0, 8)}`
  private running = false
  private loopPromise: Promise<void> | null = null

  constructor(
    private readonly redis: Redis,
    private readonly repository: ChatRepository,
    private readonly config: Config
  ) {}

  async start(): Promise<void> {
    await ensureConsumerGroup(this.redis)
    this.running = true
    this.loopPromise = this.loop()
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.loopPromise) await this.loopPromise
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        // First reclaim anything abandoned by a crashed consumer, then read fresh entries.
        const reclaimed = await claimStalePendingEntries(this.redis, this.consumerName, STALE_CLAIM_IDLE_MS, this.config.CHAT_PERSISTENCE_BATCH_SIZE)
        const fresh = await readPersistenceBatch(this.redis, this.consumerName, this.config.CHAT_PERSISTENCE_BATCH_SIZE, this.config.CHAT_PERSISTENCE_INTERVAL_MS)
        const batch = [...reclaimed, ...fresh]
        if (!batch.length) continue

        metrics.persistenceQueueDepth.set(batch.length)
        const oldestCreatedAt = Math.min(...batch.map((entry) => entry.message.createdAt))
        metrics.persistenceLagMs.record(Date.now() - oldestCreatedAt)

        await this.persistBatch(batch)
        await trimSafely(this.redis, this.config.CHAT_PERSISTENCE_STREAM_MAXLEN)
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'unknown' }, 'persistence worker loop error')
        await sleep(RETRY_BACKOFF_MS)
      }
    }
  }

  /** Batched insert inside a single Postgres transaction; only XACK entries once the commit succeeds. */
  private async persistBatch(batch: StreamEntry[], attempt = 0): Promise<void> {
    const messages = batch.map((entry) => entry.message)
    try {
      await this.repository.persistBatch(messages)
      await acknowledge(this.redis, batch.map((entry) => entry.entryId))
      logger.info({ count: batch.length }, 'persisted chat message batch')
    } catch (error) {
      const isTransient = attempt < 3
      logger.error(
        { error: error instanceof Error ? error.message : 'unknown', count: batch.length, attempt, transient: isTransient },
        'chat message batch persistence failed'
      )
      if (isTransient) {
        await sleep(RETRY_BACKOFF_MS * (attempt + 1))
        await this.persistBatch(batch, attempt + 1)
        return
      }
      // Permanent failure: leave entries un-acked so they remain pending and
      // can be reclaimed and retried later rather than silently dropped.
      metrics.persistenceFailuresTotal.inc()
      logger.error({ count: batch.length }, 'giving up on batch after repeated failures; entries remain pending for later retry')
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
