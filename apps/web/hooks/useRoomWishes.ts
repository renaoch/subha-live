"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { wishesApi, type RoomWishes } from "@/lib/api/wishes";

const POLL_MS = 8_000;

export function useRoomWishes(roomId: string, enabled: boolean, refreshKey: number) {
  const [data, setData] = useState<RoomWishes | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      setData(await wishesApi.list(roomId));
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

  const save = useCallback(
    async (wishes: Array<{ giftId: string; targetCount: number }>) => {
      setSaving(true);
      try {
        setData(await wishesApi.replace(roomId, wishes));
        toast.success("Wish Box updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update Wish Box");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [roomId],
  );

  return { data, saving, save, refetch: load };
}
