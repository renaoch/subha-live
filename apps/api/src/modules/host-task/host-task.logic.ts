// Pure, side-effect-free business logic for host tasks. Extracted from
// host-task.service.ts so the correctness-critical rules (eligibility,
// progress %, completion) can be unit-tested without a database.
//
// Every function takes its inputs explicitly and returns a value — none of
// them touch Supabase, Redis, or the network.

import type {
  HostTaskAudience,
  HostTaskGender,
  HostTaskProgressStatus,
  ViewerTaskState,
} from "./host-task.types";

/** A task is expired the moment its expires_at is <= now. */
export function isTaskExpired(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now;
}

/** A task is not-yet-started while starts_at is in the future. */
export function isTaskNotStarted(
  startsAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!startsAt) return false;
  return new Date(startsAt).getTime() > now;
}

/** True when the user's profile age (ms since created_at) is within the window. */
export function isNewUser(
  createdAt: string | null | undefined,
  windowDays: number,
  now: number = Date.now(),
): boolean {
  if (!createdAt) return false;
  const ageMs = now - new Date(createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return false;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs;
}

/**
 * Decide audience eligibility. Mirrors host-task.service's fallback: a user
 * with no profile / no created_at is treated as an "existing" user.
 */
export function resolveEligibility(
  audience: HostTaskAudience,
  createdAt: string | null | undefined,
  windowDays: number,
  now: number = Date.now(),
): boolean {
  if (audience === "all") return true;
  const isNew = isNewUser(createdAt, windowDays, now);
  return audience === "new_users" ? isNew : !isNew;
}

/**
 * Overall completion percent. When a task requires BOTH hours and coins, it
 * is only "done" once every configured target is met, so the percentage is
 * the minimum of the individual percentages (never averaged).
 */
export function computeTaskPercent(
  targetHours: number | null | undefined,
  targetCoins: number | null | undefined,
  hoursProgress: number,
  coinsProgress: number,
): number {
  const parts: number[] = [];
  if (targetHours) parts.push(Math.min(100, (hoursProgress / targetHours) * 100));
  if (targetCoins) parts.push(Math.min(100, (coinsProgress / targetCoins) * 100));
  if (parts.length === 0) return 0;
  return Number(Math.min(...parts).toFixed(2));
}

/** True only when every configured target is met. */
export function meetsTaskTarget(
  targetHours: number | null | undefined,
  targetCoins: number | null | undefined,
  hoursProgress: number,
  coinsProgress: number,
): boolean {
  if (targetHours != null && hoursProgress < targetHours) return false;
  if (targetCoins != null && coinsProgress < targetCoins) return false;
  return true;
}

/**
 * Derive the viewer-facing state from stored progress. `claimed` /
 * `completed` come straight from the stored status; otherwise a user is
 * "in_progress" only once they have made some progress, else "active".
 */
export function deriveViewerState(
  status: HostTaskProgressStatus | null | undefined,
  hoursProgress: number,
  coinsProgress: number,
): ViewerTaskState {
  if (status === "claimed") return "claimed";
  if (status === "completed") return "completed";
  if (hoursProgress > 0 || coinsProgress > 0) return "in_progress";
  return "active";
}

/** Remaining time in ms until expires_at (clamped to >= 0); null if no expiry. */
export function remainingMs(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - now);
}

/**
 * Normalise free-text profiles.gender ("Male", "female", "prefer_not_to_say",
 * null …) to the two buckets tasks can target. Anything else is null and so
 * only ever matches `target_gender = "all"`.
 */
export function normalizeGender(raw: string | null | undefined): "male" | "female" | null {
  const g = (raw ?? "").trim().toLowerCase();
  if (g === "male") return "male";
  if (g === "female") return "female";
  return null;
}

/** True when a host with `rawGender` may see / progress / claim a task. */
export function matchesTargetGender(
  target: HostTaskGender | null | undefined,
  rawGender: string | null | undefined,
): boolean {
  if (!target || target === "all") return true;
  return normalizeGender(rawGender) === target;
}

/**
 * Cap on how much streaming time one heartbeat may credit. Credits
 * min(claimed, wall-clock since the previous heartbeat, maxPerBeat) so a
 * client can never POST "86400 seconds" and finish an hours task instantly.
 * The first heartbeat for a (room,user) credits at most `firstBeatSeconds`.
 */
export function creditableSeconds(
  claimedSeconds: number,
  lastBeatAt: number | null,
  now: number = Date.now(),
  maxPerBeat = 120,
  firstBeatSeconds = 30,
): number {
  if (!(claimedSeconds > 0)) return 0;
  const sinceLast = lastBeatAt == null ? firstBeatSeconds : Math.max(0, (now - lastBeatAt) / 1000);
  return Math.max(0, Math.min(claimedSeconds, sinceLast, maxPerBeat));
}