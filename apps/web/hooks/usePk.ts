"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pkApi, type PkBattle, type PkState } from "@/lib/api/pk";
import {
  getAccessToken,
  pkBattleWsUrl,
  pkHostWsUrl,
} from "@/lib/api/realtime";

const DISCOVER_INTERVAL_MS = 4000;
const RECONNECT_DELAY_MS = 3000;

export interface PkInvite {
  battleId: string;
  fromHostId: string;
}

/**
 * PK battle state for the live room. Discovers the active battle for the room
 * (via the room's host), streams live score/timer over `/ws/pk/:battleId`, and
 * (for the host) receives directed invite/accept/decline events over
 * `/ws/pk/host/:hostId`.
 */
export function usePk(
  roomId: string,
  myUserId: string | null,
  isHost: boolean,
  roomStatus?: string | null,
) {
  const [state, setState] = useState<PkState | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<PkInvite | null>(null);
  const [acceptedInvite, setAcceptedInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomStatusRef = useRef(roomStatus);
  roomStatusRef.current = roomStatus;

  const fetchForRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const s = await pkApi.getForRoom(roomId);
      setState(s);
    } catch {
      // Discovery is best-effort; the WS / polling will reconcile.
    }
  }, [roomId]);

  // Poll the room's active battle so a viewer/host discovers it without
  // waiting for the next event.
  useEffect(() => {
    if (!roomId || !myUserId) return;
    void fetchForRoom();
    const id = window.setInterval(fetchForRoom, DISCOVER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [roomId, myUserId, fetchForRoom]);

  // Battle WS: live state once we know a battleId.
  useEffect(() => {
    const battleId = state?.battleId;
    if (!battleId) return;
    const url = pkBattleWsUrl(battleId);
    if (!url) return;

    let closed = false;
    let reconnect: number | null = null;
    let socket: WebSocket | null = null;

    const connect = async () => {
      const token = await getAccessToken();
      socket = new WebSocket(token ? `${url}?token=${encodeURIComponent(token)}` : url);
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg?.type === "PK_STATE_SYNC") {
            setState((prev) =>
              prev ? { ...prev, ...msg, battleId: msg.battleId } : null,
            );
          } else if (msg?.type === "PK_SCORE_UPDATE") {
            setState((prev) =>
              prev
                ? { ...prev, scoreA: msg.scoreA, scoreB: msg.scoreB, version: msg.version }
                : prev,
            );
          } else if (msg?.type === "PK_START") {
            setState((prev) =>
              prev
                ? { ...prev, status: "ACTIVE", startedAt: msg.startedAt, endsAt: msg.endsAt }
                : prev,
            );
          } else if (msg?.type === "PK_RESULT") {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    status: "FINISHED",
                    scoreA: msg.scoreA,
                    scoreB: msg.scoreB,
                    winner: msg.winner,
                  }
                : prev,
            );
          } else if (msg?.type === "PK_CANCEL") {
            setState(null);
            setAcceptedInvite(null);
            setIncomingInvite(null);
          }
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        if (!closed) reconnect = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket?.close();
    };

    void connect();
    return () => {
      closed = true;
      if (reconnect !== null) window.clearTimeout(reconnect);
      socket?.close();
    };
  }, [state?.battleId]);

  // Host WS: directed invite/accept/decline events.
  useEffect(() => {
    if (!isHost || !myUserId) return;
    const url = pkHostWsUrl(myUserId);
    if (!url) return;

    let closed = false;
    let reconnect: number | null = null;
    let socket: WebSocket | null = null;

    const connect = async () => {
      const token = await getAccessToken();
      socket = new WebSocket(token ? `${url}?token=${encodeURIComponent(token)}` : url);
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg?.type === "PK_INVITE") {
            setIncomingInvite({ battleId: msg.battleId, fromHostId: msg.fromHostId });
          } else if (msg?.type === "PK_ACCEPT") {
            setAcceptedInvite(msg.battleId);
          } else if (msg?.type === "PK_DECLINE") {
            setAcceptedInvite(null);
            setIncomingInvite(null);
          }
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        if (!closed) reconnect = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket?.close();
    };

    void connect();
    return () => {
      closed = true;
      if (reconnect !== null) window.clearTimeout(reconnect);
      socket?.close();
    };
  }, [isHost, myUserId]);

  const invite = useCallback(
    async (opponentHostId: string): Promise<PkBattle | null> => {
      setBusy(true);
      setError(null);
      try {
        const battle = await pkApi.invite(roomId, opponentHostId);
        setAcceptedInvite(null);
        return battle;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to invite");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [roomId],
  );

  const accept = useCallback(async (battleId: string) => {
    setBusy(true);
    setError(null);
    try {
      await pkApi.accept(battleId);
      setIncomingInvite(null);
      setAcceptedInvite(battleId);
      void fetchForRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  }, [fetchForRoom]);

  const decline = useCallback(async (battleId: string) => {
    setBusy(true);
    setError(null);
    try {
      await pkApi.decline(battleId);
      setIncomingInvite(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(async (battleId: string) => {
    setBusy(true);
    setError(null);
    try {
      await pkApi.start(battleId);
      setAcceptedInvite(null);
      void fetchForRoom();
      toast.success("PK battle started");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [fetchForRoom]);

  const cancel = useCallback(async (battleId: string) => {
    setBusy(true);
    setError(null);
    try {
      await pkApi.cancel(battleId);
      setState(null);
      setIncomingInvite(null);
      setAcceptedInvite(null);
      void fetchForRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  }, [fetchForRoom]);

  const reset = useCallback(() => {
    setIncomingInvite(null);
    setAcceptedInvite(null);
    setError(null);
  }, []);

  return {
    state,
    incomingInvite,
    acceptedInvite,
    busy,
    error,
    invite,
    accept,
    decline,
    start,
    cancel,
    reset,
    refetch: fetchForRoom,
  };
}
