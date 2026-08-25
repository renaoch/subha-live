export const MEDIA_REDIS_PREFIX = "room";

export const MEDIA_ROOM_RESOURCES = {
  MEDIA: "media",
  SPEAKERS: "speakers",
  VIEWERS: "viewers",
  LEASES: "leases",
  SEQUENCE: "sequence",
  IDEMPOTENCY: "idempotency",
  LOCKS: "locks",
} as const;

export const MEDIA_TRACK_NAMES = {
  HOST_VIDEO: "host-video",
  HOST_AUDIO: "host-audio",
} as const;

export const MEDIA_SESSION_STATUSES = [
  "creating",
  "connecting",
  "connected",
  "reconnecting",
  "closing",
  "closed",
  "failed",
] as const;

export const MEDIA_ROOM_STATUSES = [
  "idle",
  "starting",
  "live",
  "degraded",
  "ending",
  "ended",
] as const;

export const MEDIA_PARTICIPANT_ROLES = [
  "host",
  "speaker",
  "viewer",
] as const;

export const MEDIA_TRACK_KINDS = [
  "audio",
  "video",
] as const;

export const MEDIA_TRACK_DIRECTIONS = [
  "publish",
  "subscribe",
] as const;

export const MEDIA_NEGOTIATION_STATES = [
  "stable",
  "queued",
  "negotiating",
  "waiting_for_answer",
  "completed",
  "failed",
] as const;
export const MEDIA_SLOT_LIMITS = {
  guestAudio: 3,
  guestVideo: 1,
} as const;
