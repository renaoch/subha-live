"use client";

import { useCallback, useEffect, useState } from "react";
import { roomsApi, type RoomModerationList } from "@/lib/api/rooms";

/**
 * One shared, per-room moderation state. The participant profile and the
 * Blocked Users sheet both read from here, so blocking / unblocking in one is
 * reflected in the other immediately, without a reload. The server stays the
 * source of truth: state only changes after the API call succeeds, then we
 * re-fetch so we never show a restriction that isn't real.
 */

const EMPTY: RoomModerationList = { blocked: [], muted: [], micMuted: [] };

interface Entry {
  data: RoomModerationList;
  loaded: boolean;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function emit(roomId: string) {
  listeners.get(roomId)?.forEach((fn) => fn());
}

async function refresh(roomId: string): Promise<RoomModerationList> {
  const data = await roomsApi.moderationList(roomId);
  cache.set(roomId, { data, loaded: true });
  emit(roomId);
  return data;
}

/** Run a moderation call, then re-sync from the server. Throws on failure. */
export async function runModeration(roomId: string, call: () => Promise<unknown>): Promise<void> {
  await call();
  await refresh(roomId).catch(() => {});
}

export function useRoomModeration(roomId: string | null, enabled = true) {
  const [, tick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!roomId) return;
    try {
      setError(null);
      await refresh(roomId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load moderation state");
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !enabled) return;
    const set = listeners.get(roomId) ?? new Set();
    const fn = () => tick((n) => n + 1);
    set.add(fn);
    listeners.set(roomId, set);
    void reload();
    return () => {
      set.delete(fn);
    };
  }, [roomId, enabled, reload]);

  const entry = roomId ? cache.get(roomId) : undefined;
  return {
    data: entry?.data ?? EMPTY,
    loaded: entry?.loaded ?? false,
    error,
    reload,
  };
}
