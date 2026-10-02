"use client";

// Authoritative audio party-room stage state. Polls GET /rooms/:id/stage
// (room-stage.service.ts) — the single source of truth for seat layout, host,
// listener/request counts, and per-user mic/mute/speaking state — and lets a
// seated participant report their own mic state and leave their seat.
//
// The heavy per-audience Redis work is already done once per second by the
// backend (see the snapshot cache in room-stage.service.ts); this hook just
// consumes it. `rev` is used so the (larger) profile map is only refetched
// when the seat layout actually changed.

import { useCallback, useEffect, useRef, useState } from "react";
import { roomsApi, type StageSnapshotResult } from "@/lib/api/rooms";

export interface StageProfile {
  name: string;
  avatar: string | null;
}

interface UseRoomStageOptions {
  roomId: string;
  isLive: boolean;
  enabled?: boolean;
}

export function useRoomStage({ roomId, isLive, enabled = true }: UseRoomStageOptions) {
  const [stage, setStage] = useState<StageSnapshotResult | null>(null);
  const [profiles, setProfiles] = useState<Record<string, StageProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revRef = useRef<number | undefined>(undefined);
  const pollDelayRef = useRef<number>(2500);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    if (!roomId) return;
    try {
      const snapshot = await roomsApi.getStage(roomId, revRef.current);
      if (!mountedRef.current) return;
      revRef.current = snapshot.rev;
      pollDelayRef.current = snapshot.pollMs?.listener ?? 2500;
      setStage(snapshot);
      if (snapshot.profiles) {
        setProfiles(snapshot.profiles);
      }
      setError(null);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load the stage");
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !isLive || !enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await poll();
      if (cancelled) return;
      timer = setTimeout(tick, pollDelayRef.current);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isLive, enabled]);

  const report = useCallback(
    async (input: { speaking?: boolean; muted?: boolean }) => {
      if (!roomId) return;
      await roomsApi.reportStage(roomId, input).catch(() => {});
    },
    [roomId],
  );

  const leaveSeat = useCallback(async () => {
    if (!roomId) return;
    await roomsApi.leaveSeat(roomId).catch(() => {});
  }, [roomId]);

  return {
    stage,
    profiles,
    loading,
    error,
    refresh: poll,
    report,
    leaveSeat,
  };
}
