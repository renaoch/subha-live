"use client";

import { useCallback, useEffect, useState } from "react";
import { challengesApi, type RoomChallenge } from "@/lib/api/challenges";

const POLL_MS = 20_000;

/** Active Regional Star Challenge for this room's host (null when none is running). */
export function useRoomChallenge(roomId: string, enabled: boolean, refreshKey: number) {
  const [data, setData] = useState<RoomChallenge | null>(null);
  // serverNow - clientNow, so the countdown is right even on a wrong device clock.
  const [skewMs, setSkewMs] = useState(0);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await challengesApi.forRoom(roomId);
      setData(res);
      if (res) setSkewMs(new Date(res.serverNow).getTime() - Date.now());
    } catch {
      /* keep last good value */
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

  return { data, skewMs, refetch: load };
}

/** Ticking countdown to `endsAt`, formatted like "2D 12:30:45". */
export function useCountdown(endsAt: string | null | undefined, skewMs = 0) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [endsAt]);

  if (!endsAt) return { label: "", done: true, remainingMs: 0 };
  const remainingMs = Math.max(0, new Date(endsAt).getTime() - (now + skewMs));
  const total = Math.floor(remainingMs / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = `${d > 0 ? `${d}D ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
  return { label, done: remainingMs <= 0, remainingMs };
}
