"use client";

import { useCallback, useEffect, useState } from "react";
import { roomOverviewApi, type RoomOverview } from "@/lib/api/room-overview";

const POLL_MS = 20_000;

/**
 * Header data that is not on the room record: host public ID, today's top
 * three gifters, and the host's daily rank. Polled lightly (the API caches
 * for 10s) and refetched immediately whenever `refreshKey` changes — the room
 * page bumps it when a new gift lands in chat, so the leaderboard avatars and
 * the "Top N" pill move as gifts arrive.
 */
export function useRoomOverview(roomId: string, enabled: boolean, refreshKey: number) {
  const [overview, setOverview] = useState<RoomOverview | null>(null);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      setOverview(await roomOverviewApi.get(roomId));
    } catch {
      /* keep last good value; the header degrades gracefully without it */
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [enabled, roomId, load]);

  useEffect(() => {
    if (enabled && refreshKey > 0) void load();
  }, [refreshKey, enabled, load]);

  return overview;
}
