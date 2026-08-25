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
    maxAttempts: 2,
    baseDelayMs: 500,
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