/**
 * Lightweight in-process counters/gauges/histograms. This is intentionally
 * dependency-free so it has no opinion about your metrics backend - scrape
 * GET /metrics and forward into Prometheus/Datadog/CloudWatch/etc, or swap
 * this module for a real client library without touching call sites much.
 */
class Histogram {
  private samples: number[] = []
  record(value: number) {
    this.samples.push(value)
    if (this.samples.length > 5000) this.samples.shift() // bounded memory
  }
  snapshot() {
    if (!this.samples.length) return { count: 0, p50: 0, p95: 0, p99: 0 }
    const sorted = [...this.samples].sort((a, b) => a - b)
    const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
    return { count: sorted.length, p50: at(50), p95: at(95), p99: at(99) }
  }
}

class Counter {
  private value = 0
  inc(by = 1) {
    this.value += by
  }
  get() {
    return this.value
  }
}

class Gauge {
  private value = 0
  set(value: number) {
    this.value = value
  }
  inc(by = 1) {
    this.value += by
  }
  dec(by = 1) {
    this.value -= by
  }
  get() {
    return this.value
  }
}

export const metrics = {
  activeConnections: new Gauge(),
  activeRooms: new Gauge(),
  messagesTotal: new Counter(),
  messageProcessingLatencyMs: new Histogram(),
  websocketLatencyMs: new Histogram(),
  redisLatencyMs: new Histogram(),
  redisCacheHits: new Counter(),
  redisCacheMisses: new Counter(),
  historyRequestsTotal: new Counter(),
  historyCacheMisses: new Counter(),
  lockContentionTotal: new Counter(),
  postgresLatencyMs: new Histogram(),
  persistenceQueueDepth: new Gauge(),
  persistenceLagMs: new Histogram(),
  persistenceFailuresTotal: new Counter(),
  rateLimitRejectionsTotal: new Counter(),
  websocketErrorsTotal: new Counter(),
}

export function metricsSnapshot() {
  return {
    activeConnections: metrics.activeConnections.get(),
    activeRooms: metrics.activeRooms.get(),
    messagesTotal: metrics.messagesTotal.get(),
    messageProcessingLatencyMs: metrics.messageProcessingLatencyMs.snapshot(),
    websocketLatencyMs: metrics.websocketLatencyMs.snapshot(),
    redisLatencyMs: metrics.redisLatencyMs.snapshot(),
    redisCacheHits: metrics.redisCacheHits.get(),
    redisCacheMisses: metrics.redisCacheMisses.get(),
    redisCacheHitRate: ratio(metrics.redisCacheHits.get(), metrics.redisCacheMisses.get()),
    historyRequestsTotal: metrics.historyRequestsTotal.get(),
    historyCacheMisses: metrics.historyCacheMisses.get(),
    lockContentionTotal: metrics.lockContentionTotal.get(),
    postgresLatencyMs: metrics.postgresLatencyMs.snapshot(),
    persistenceQueueDepth: metrics.persistenceQueueDepth.get(),
    persistenceLagMs: metrics.persistenceLagMs.snapshot(),
    persistenceFailuresTotal: metrics.persistenceFailuresTotal.get(),
    rateLimitRejectionsTotal: metrics.rateLimitRejectionsTotal.get(),
    websocketErrorsTotal: metrics.websocketErrorsTotal.get(),
  }
}

function ratio(hits: number, misses: number): number {
  const total = hits + misses
  return total === 0 ? 0 : Number((hits / total).toFixed(4))
}
