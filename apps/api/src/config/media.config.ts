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
    /**
     * Bitrate of the single pre-mixed "room mix" track a party host
     * publishes for the audience (see `stage` below). Mono Opus with DTX
     * is transparent for speech at 24-32 kbps.
     */
    mixMaxBitrate: 32_000,
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

    /**
     * Total time (from the host's last heartbeat) that a room is allowed
     * to sit with a silent host before it's treated as truly gone and the
     * room is auto-ended. Kept generous relative to heartbeat.timeoutMs
     * (30s) so a refresh, a brief network blip, or a tab backgrounding on
     * mobile doesn't cost the host their room — but the room can't stay
     * "live" forever with nobody actually broadcasting either.
     */
    hostReconnectGraceMs: 60_000,
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

    /*
     * Ceiling on the TOTAL time one Cloudflare Realtime call (all
     * attempts + all backoff sleeps combined) is allowed to take.
     *
     * 6 attempts against a Cloudflare endpoint that can take ~11-12s
     * per 425 response, plus backoff between them, can add up to
     * 80-90+ seconds for a single call — comfortably longer than the
     * timeout on whatever reverse proxy/gateway sits in front of this
     * API. When that happens the platform kills the connection first
     * and the browser sees a bare 502 with no CORS headers, which it
     * misreports as a CORS error — masking the real cause (this
     * request ran too long). Keep this well under any realistic
     * gateway timeout so we always fail cleanly on our own terms
     * first, with a real, retryable error the client can act on.
     */
    overallDeadlineMs: 20_000,
  },

  idempotency: {
    ttlSeconds: 60 * 10,
  },

  redis: {
    roomStateTtlSeconds: 60 * 60 * 24,
  },

  limits: {
    /*
     * Hard ceiling on concurrent guest/speaker seats, enforced
     * server-side regardless of what a room's `max_guest_slots` column
     * says — that column is user-editable at room-creation time, so it
     * is never trusted as the sole source of truth for a limit this
     * consequential (Cloudflare Calls session count, SFU load).
     *
     * Video rooms stay capped at 3 concurrent camera+mic guests, which
     * is what this used to be unconditionally. Audio rooms have no
     * camera track at all — just mic-only Cloudflare sessions, which
     * are far cheaper — so "Go Party" audio rooms are allowed up to 10
     * seats.
     */
    maxGuestSlots: {
      video: 3,
      audio: 10,
    },
  },

  /**
   * Audio "party" room scaling model (10k+ concurrent listeners).
   *
   * Only the host and the seated speakers (max 11 people) take part in
   * the full mesh of raw tracks. Everybody else is a *listener*: they pull
   * ONE pre-mixed track (published by the host, see useAudioRoom) so the
   * SFU egress per listener is a constant ~32 kbps no matter how many
   * people are on stage, and a seat change never forces a renegotiation
   * on thousands of listener peer connections.
   *
   * Listener state is kept O(1)/O(log n) in Redis (a sorted set of
   * last-seen timestamps + one hash of session ids) and the polled stage
   * snapshot is cached in-process, so read cost is independent of the
   * audience size.
   */
  stage: {
    /** A listener counts as present if seen within this window. */
    listenerTtlMs: 45_000,
    /** In-process cache lifetime of the shared (non user-specific) snapshot. */
    snapshotCacheMs: 1_000,
    /** A "speaking" report is considered live for this long. */
    speakingTtlMs: 3_000,
    /** How often the pruner may trim the listener zset per room. */
    pruneEveryMs: 30_000,
    /** Suggested client poll intervals, scaled by audience size. */
    poll: {
      stageMs: 1_500,
      listenerSmallMs: 2_500,
      listenerMediumMs: 4_000,
      listenerLargeMs: 6_000,
      mediumAudience: 500,
      largeAudience: 3_000,
    },
  },
} as const;