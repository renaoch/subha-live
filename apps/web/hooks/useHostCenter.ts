"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { hostTasksApi, type HostCenterData } from "@/lib/api/host-task";

const POLL_MS = 10_000;

/**
 * Data for the host's in-room Task Center. Only runs for the room's host.
 * The server filters tasks by the host's gender, so whatever comes back is
 * already the right set for them.
 */
export function useHostCenter(roomId: string, enabled: boolean, open: boolean) {
  const [data, setData] = useState<HostCenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimInFlight = useRef(false);

  const refetch = useCallback(async () => {
    if (!roomId || !enabled) return;
    try {
      setData(await hostTasksApi.getHostCenter(roomId));
    } catch (e) {
      console.error("[useHostCenter] failed to load:", e);
    }
  }, [roomId, enabled]);

  // One load on mount (drives the red "claimable" dot), faster polling while open.
  useEffect(() => {
    if (!enabled || !roomId) return;
    setLoading(true);
    void refetch().finally(() => setLoading(false));
  }, [enabled, roomId, refetch]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    const id = window.setInterval(() => void refetch(), open ? POLL_MS : POLL_MS * 6);
    return () => window.clearInterval(id);
  }, [enabled, roomId, open, refetch]);

  const claim = useCallback(
    async (taskId: string) => {
      if (claimInFlight.current) return;
      claimInFlight.current = true;
      setClaimingId(taskId);
      try {
        const result = await hostTasksApi.claim(taskId);
        toast.success(`+${result.rewardAmount} coins added to your balance!`);
        await refetch();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to claim reward";
        if (message.toLowerCase().includes("already")) await refetch();
        else toast.error(message);
      } finally {
        claimInFlight.current = false;
        setClaimingId(null);
      }
    },
    [refetch],
  );

  const claimable = (data?.tasks ?? []).filter((t) => t.state === "completed" && t.rewardAmount > 0).length;

  return { data, loading, claimingId, claim, refetch, claimable };
}