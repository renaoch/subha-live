export const mediaConfig = {
  video: {
    width: 640,
    height: 360,
    maxBitrate: 600_000,
    maxFramerate: 24,
  },

  audio: {
    channels: 1,
    maxBitrate: 24_000,
    dtx: true,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },

  heartbeat: {
    intervalMs: 15_000,
    timeoutMs: 30_000,
  },

  session: {
    staleAfterMs: 30_000,
  },

  retry: {
    /*
     * Cloudflare Calls can return HTTP 425 "Session is not ready yet"
     * from /tracks/new even after the browser's RTCPeerConnection
     * reports connectionState "connected" — Cloudflare's edge marks
     * the session ready on its own schedule, independent of what the
     * browser observes locally, and per Cloudflare's own guidance
     * this is expected and should be retried rather than treated as a
     * hard failure. Production logs show a single 425 response taking
     * 12+ seconds to arrive; the previous budget (2 total attempts,
     * 2s max backoff) was exhausted before the session ever became
     * ready, permanently failing the guest's mic publish and leaving
     * their speaker entry stuck in "connecting" until the 30s stale
     * reaper cleaned it up. Give this real headroom instead of
     * papering over it with a longer single delay.
     */
    maxAttempts: 6,
    baseDelayMs: 600,
    maxDelayMs: 4_000,
  },

  idempotency: {
    ttlSeconds: 60 * 10,
  },

  redis: {
    roomStateTtlSeconds: 60 * 60 * 24,
  },

  limits: {
    maxGuestSlots: 3,
  },
} as const;