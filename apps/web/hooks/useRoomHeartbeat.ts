"use client";

import { useEffect, useRef } from "react";
import { hostTasksApi } from "@/lib/api/host-task";

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Periodically reports elapsed time in the room so the backend can accrue
 * streaming/watch hours toward an active host task. Best-effort and silent —
 * the backend is the source of truth for progress, and a missed heartbeat
 * simply means slightly less accrued time for that minute.
 */
export function useRoomHeartbeat(roomId: string, roomStatus?: string | null) {
  const lastSentRef = useRef<number | null>(null);

  useEffect(() => {
    if (!roomId || (roomStatus !== "live" && roomStatus !== "created")) return;

    const send = async () => {
      const now = Date.now();
      if (lastSentRef.current !== null) {
        const elapsed = Math.min(HEARTBEAT_INTERVAL_MS, now - lastSentRef.current);
        const seconds = Math.round(elapsed / 1000);
        if (seconds > 0) {
          hostTasksApi.heartbeat(roomId, seconds).catch(() => {
            // Ignore — progress accrues on the next successful heartbeat.
          });
        }
      }
      lastSentRef.current = now;
    };

    lastSentRef.current = Date.now();
    const id = window.setInterval(send, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(id);
      lastSentRef.current = null;
    };
  }, [roomId, roomStatus]);
}
