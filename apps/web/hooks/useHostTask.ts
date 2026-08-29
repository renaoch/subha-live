"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  hostTasksApi,
  type HostTaskStats,
  type ViewerHostTask,
} from "@/lib/api/host-task";
import { getAccessToken, taskWsUrl } from "@/lib/api/realtime";

const POLL_INTERVAL_MS = 5000;
const RECONNECT_DELAY_MS = 3000;

/**
 * Tracks the room's host task (per-user task/reward) for both the host and
 * viewers, driving the card rendered just below the viewer count.
 *
 * Realtime-first: subscribes to the room's task WebSocket and refetches the
 * source of truth on every task event, so progress/claims update without a
 * page refresh. When the realtime service is unreachable (or unconfigured)
 * it transparently falls back to polling.
 */
export function useHostTask(
  roomId: string,
  roomStatus?: string | null,
  isHost = false,
) {
  const [task, setTask] = useState<ViewerHostTask | null>(null);
  const [stats, setStats] = useState<HostTaskStats | null>(null);
  const [claiming, setClaiming] = useState(false);
  const claimInFlightRef = useRef(false);

  const fetchTask = useCallback(async () => {
    if (!roomId) return;

    try {
      const [result, statsResult] = await Promise.all([
        hostTasksApi.getRoomTask(roomId),
        isHost ? hostTasksApi.listRoomTasks(roomId).catch(() => null) : Promise.resolve(null),
      ]);

      setTask(result);

      if (isHost && statsResult) {
        const active = statsResult.find((t) => t.id === result?.id) ?? statsResult[0];
        setStats(active?.stats ?? null);
      }
    } catch (e) {
      console.error("[useHostTask] failed to fetch task:", e);
    }
  }, [roomId, isHost]);

  // Initial load + polling fallback, only while the room is live/waiting.
  useEffect(() => {
    if (!roomId || (roomStatus !== "live" && roomStatus !== "created")) return;

    fetchTask();
    const id = window.setInterval(fetchTask, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [roomId, roomStatus, fetchTask]);

  // Realtime subscription. On any task event we refetch the durable state;
  // the event itself is only a "something changed" signal.
  useEffect(() => {
    if (!roomId || (roomStatus !== "live" && roomStatus !== "created")) return;

    let socket: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = async () => {
      const url = taskWsUrl(roomId);
      if (!url) return; // No realtime service configured — rely on polling.

      const token = await getAccessToken();
      const target = token ? `${url}?token=${encodeURIComponent(token)}` : url;

      socket = new WebSocket(target);

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && typeof msg.type === "string" && msg.type.startsWith("task.")) {
            fetchTask();
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      socket.onclose = () => {
        if (!closed && (roomStatus === "live" || roomStatus === "created")) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    void connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [roomId, roomStatus, fetchTask]);

  const claim = useCallback(async () => {
    if (!task || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    setClaiming(true);

    try {
      const result = await hostTasksApi.claim(task.id);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              state: "claimed",
              claimedAt: result.claimedAt,
              progress: { ...prev.progress, percent: 100 },
            }
          : prev,
      );
      toast.success(`+${result.rewardAmount} coins added to your balance!`);
      await fetchTask();
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to claim reward";
      if (message.toLowerCase().includes("already claimed")) {
        await fetchTask();
      } else {
        toast.error(message);
      }
      throw e;
    } finally {
      claimInFlightRef.current = false;
      setClaiming(false);
    }
  }, [task, fetchTask]);

  return { task, stats, claiming, claim, refetch: fetchTask };
}
