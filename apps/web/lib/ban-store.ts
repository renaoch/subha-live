"use client";

import { useSyncExternalStore } from "react";

/** What the server tells us about an active ban. */
export interface BanInfo {
  id: string;
  reason: string;
  permanent: boolean;
  /** ISO time the ban lifts; null when permanent. */
  until: string | null;
  bannedAt: string;
}

interface BanState {
  ban: BanInfo | null;
  /** serverNow - clientNow, so the countdown is right on a wrong device clock. */
  skewMs: number;
}

let state: BanState = { ban: null, skewMs: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setBan(ban: BanInfo | null, serverNow?: string) {
  const skewMs = serverNow ? new Date(serverNow).getTime() - Date.now() : state.skewMs;
  // Don't churn subscribers (and re-render the whole ban screen) for identical data.
  if (state.ban?.id === ban?.id && state.ban?.until === ban?.until && skewMs === state.skewMs) return;
  state = { ban, skewMs };
  emit();
}

/** Called by the API client when ANY request comes back 403 ACCOUNT_BANNED. */
export function reportBanFromError(details: unknown) {
  const d = details as Partial<BanInfo> | undefined;
  if (d && typeof d.reason === "string" && typeof d.permanent === "boolean") {
    setBan({
      id: String(d.id ?? "unknown"),
      reason: d.reason,
      permanent: d.permanent,
      until: d.until ?? null,
      bannedAt: d.bannedAt ?? new Date().toISOString(),
    });
  }
}

export function useBanState(): BanState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
