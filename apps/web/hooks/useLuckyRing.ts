// hooks/useLuckyRing.ts
//
// Client state for the shared-room Lucky Ring game. The server is the sole
// authority for the round's phase, timer and winning cell; this hook polls
// GET /lucky-ring/state and derives a smooth local countdown between polls.
//
// NOTE — polling, not a socket: apps/chat-room/realtime has no `lucky_ring`
// WebSocket gateway yet (see the note in the API's lucky-ring.events.ts), so
// every viewer in the room converges on the same round by polling the same
// server-authoritative endpoint rather than receiving a push. This means up
// to ~POLL_MS of lag between the true phase change and a given client seeing
// it — acceptable for a game where the outcome doesn't depend on reaction
// speed, but swap this for a WebSocket subscription (mirroring usePk.ts) once
// that gateway ships, for instant, byte-for-byte-synced reveals.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  luckyRingApi,
  newClientRequestId,
  type LuckyRingPublicConfig,
  type LuckyRingRecentResult,
  type LuckyRingStateResponse,
  type LuckyRingStatus,
} from "@/lib/api/lucky-ring";

const POLL_MS = 1200;
const TICK_MS = 100;

export interface LuckyRingError {
  code?: string;
  message: string;
}

export function useLuckyRing(roomId: string) {
  const [config, setConfig] = useState<LuckyRingPublicConfig | null>(null);
  const [status, setStatus] = useState<LuckyRingStatus>("BETTING");
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [winningCell, setWinningCell] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [todayWinnings, setTodayWinnings] = useState(0);
  const [myBets, setMyBets] = useState<Record<number, number>>({}); // cellIndex -> amount, this round
  const [recentResults, setRecentResults] = useState<LuckyRingRecentResult[]>([]);
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [msLeft, setMsLeft] = useState(0);
  const [error, setError] = useState<LuckyRingError | null>(null);
  const [placingCell, setPlacingCell] = useState<number | null>(null);

  const mounted = useRef(true);
  const lastRoundId = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyState = useCallback((state: LuckyRingStateResponse) => {
    setConfig(state.config);
    setStatus(state.status);
    setRoundId(state.roundId);
    setRoundNumber(state.roundNumber);
    setPhaseEndsAt(state.phaseEndsAt);
    setWinningCell(state.winningCell);
    setBalance(state.balance);
    setTodayWinnings(state.todayWinnings);
    setSelectedBet((prev) => prev ?? state.config.bets[0] ?? null);

    // Rebuild from the server's authoritative bets every poll — this also
    // naturally clears last round's chips as soon as the round id changes.
    lastRoundId.current = state.roundId;
    const bets: Record<number, number> = {};
    for (const b of state.myBets) bets[b.cellIndex] = b.amount;
    setMyBets(bets);

    setRecentResults(state.recentResults);
  }, []);

  const poll = useCallback(async () => {
    if (!roomId) return;
    try {
      const state = await luckyRingApi.state(roomId);
      if (!mounted.current) return;
      applyState(state);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError({
        code: err instanceof ApiError ? err.code : undefined,
        message: "Couldn't reach the table — retrying…",
      });
    }
  }, [roomId, applyState]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  // Smooth local countdown between polls, resynced every poll by phaseEndsAt.
  useEffect(() => {
    const id = window.setInterval(() => {
      setMsLeft(phaseEndsAt != null ? Math.max(0, phaseEndsAt - Date.now()) : 0);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phaseEndsAt]);

  const placeBet = useCallback(
    async (cellIndex: number) => {
      if (!roomId || selectedBet == null || status !== "BETTING") return;
      if (balance != null && balance < selectedBet) {
        setError({ message: "Not enough coins for that bet." });
        return;
      }
      setPlacingCell(cellIndex);
      // Optimistic: show the chip immediately, reconciled on the next poll.
      setMyBets((prev) => ({ ...prev, [cellIndex]: (prev[cellIndex] ?? 0) + selectedBet }));
      setBalance((b) => (b == null ? b : b - selectedBet));

      try {
        const res = await luckyRingApi.bet({
          roomId,
          cellIndex,
          amount: selectedBet,
          clientRequestId: newClientRequestId(),
        });
        if (!mounted.current) return;
        setBalance(res.newCoins);
        setMyBets((prev) => ({ ...prev, [cellIndex]: res.totalOnCell }));
      } catch (err) {
        if (!mounted.current) return;
        // Roll back the optimistic chip on a real rejection.
        setMyBets((prev) => ({ ...prev, [cellIndex]: Math.max(0, (prev[cellIndex] ?? 0) - selectedBet) }));
        setBalance((b) => (b == null ? b : b + selectedBet));
        setError({
          code: err instanceof ApiError ? err.code : undefined,
          message:
            err instanceof ApiError && err.code === "LUCKY_RING_BETTING_CLOSED"
              ? "Betting just closed for this round."
              : "Bet didn't go through — try again.",
        });
        void poll();
      } finally {
        if (mounted.current) setPlacingCell(null);
      }
    },
    [roomId, selectedBet, status, balance, poll],
  );

  return {
    config,
    status,
    roundId,
    roundNumber,
    phaseEndsAt,
    msLeft,
    winningCell,
    balance,
    todayWinnings,
    myBets,
    recentResults,
    selectedBet,
    setSelectedBet,
    bets: config?.bets ?? [],
    cells: config?.cells ?? [],
    placeBet,
    placingCell,
    error,
    reload: poll,
  };
}