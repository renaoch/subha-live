"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { liveBoxApi, type LiveBoxStatus } from "@/lib/api/live-box";

/**
 * Viewer's watch-time gift box for this room. All eligibility, timing and
 * limits are decided by the server; the client only renders the countdown
 * (corrected by the server clock) and asks to claim.
 */
export function useLiveBox(roomId: string, enabled: boolean, onClaimed?: () => void) {
  const [status, setStatus] = useState<LiveBoxStatus | null>(null);
  const [skewMs, setSkewMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const s = await liveBoxApi.status(roomId);
      setStatus(s);
      setSkewMs(new Date(s.serverNow).getTime() - Date.now());
    } catch {
      /* keep last state */
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [enabled, roomId, load]);

  useEffect(() => {
    if (!status?.available) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status?.available]);

  const remainingMs = status?.nextReadyAt
    ? Math.max(0, new Date(status.nextReadyAt).getTime() - (now + skewMs))
    : 0;
  const exhausted = !!status && status.remainingToday <= 0;
  const ready = !!status?.available && !exhausted && !!status.nextReadyAt && remainingMs <= 0;

  const claim = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setClaiming(true);
    try {
      const r = await liveBoxApi.claim(roomId);
      toast.success(`Gift box opened: +${r.rewardCoins} coins 🎁`);
      onClaimed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the gift box");
    } finally {
      inFlight.current = false;
      setClaiming(false);
      await load();
    }
  }, [roomId, load, onClaimed]);

  return { status, remainingMs, ready, exhausted, claiming, claim };
}
