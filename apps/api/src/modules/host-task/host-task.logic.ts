// Pure, side-effect-free business logic for host tasks. Extracted from
// host-task.service.ts so the correctness-critical rules (eligibility,
// progress %, completion) can be unit-tested without a database.
//
// Every function takes its inputs explicitly and returns a value — none of
// them touch Supabase, Redis, or the network.

import type {
  HostTaskAudience,
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
