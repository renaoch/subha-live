// hooks/useLuckyRing.ts
//
// Client state for the shared-room Lucky Ring game. The server is the sole
// authority for the round's phase, timer and winning cell. Two things this
// version fixes that made the countdown feel "off":
//
// 1. CLOCK DRIFT — phaseEndsAt is an absolute server timestamp. If the
//    device's own clock is even a second or two off (common on phones),
//    comparing it directly against `Date.now()` produces a countdown that's
//    visibly wrong or jumps. Every poll response carries `serverTime`; we
//    track the offset between that and our own clock and apply it to all
//    countdown math, so the number always matches the server's real deadline.
// 2. JITTER ON RESYNC — naively overwriting phaseEndsAt on every ~1s poll
//    makes the displayed number flicker backward/forward by tens of ms each
//    time, which reads as "broken" even though it's harmless network noise.
//    We only accept a resynced deadline if it actually moved meaningfully
//    (phase/round changed, or drifted >250ms) — otherwise we keep predicting
//    locally and let the tick stay silky.
//
// Still polling, not a socket: see the note in the API's lucky-ring.events.ts
// for why (no `lucky_ring` WebSocket gateway exists yet).

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

const POLL_MS = 900;
const RESYNC_DRIFT_TOLERANCE_MS = 250;

export interface LuckyRingError {
  code?: string;
  message: string;
}

export function useLuckyRing(roomId: string) {
  const [config, setConfig] = useState<LuckyRingPublicConfig | null>(null);
  const [status, setStatus] = useState<LuckyRingStatus>("BETTING");
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
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
  const lastStatus = useRef<LuckyRingStatus | null>(null);
  const clockOffsetRef = useRef(0); // serverTime - localTimeAtReceipt
  const phaseEndsAtRef = useRef<number | null>(null); // the deadline we're actually ticking against
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const applyState = useCallback((state: LuckyRingStateResponse) => {
    const receivedAt = Date.now();
    clockOffsetRef.current = state.serverTime - receivedAt;

    setConfig(state.config);
    setBalance(state.balance);
    setTodayWinnings(state.todayWinnings);
    setSelectedBet((prev) => prev ?? state.config.bets[0] ?? null);
    setRecentResults(state.recentResults);

    const phaseChanged = state.status !== lastStatus.current || state.roundId !== lastRoundId.current;

    if (phaseChanged) {
      // A real phase/round transition — always jump straight to the server's
      // value, no damping, so the UI never lags behind the true game state.
      lastStatus.current = state.status;
      lastRoundId.current = state.roundId;
      phaseEndsAtRef.current = state.phaseEndsAt;
      setStatus(state.status);
      setRoundId(state.roundId);
      setRoundNumber(state.roundNumber);
      setWinningCell(state.winningCell);

      const bets: Record<number, number> = {};
      for (const b of state.myBets) bets[b.cellIndex] = b.amount;
      setMyBets(bets);
    } else {
      // Same phase as last poll — only resync the deadline if it drifted by
      // more than the tolerance; otherwise keep ticking against our existing
      // prediction so the number doesn't visibly jitter every ~900ms.
      const current = phaseEndsAtRef.current;
      if (
        state.phaseEndsAt != null &&
        (current == null || Math.abs(state.phaseEndsAt - current) > RESYNC_DRIFT_TOLERANCE_MS)
      ) {
        phaseEndsAtRef.current = state.phaseEndsAt;
      }
      setWinningCell(state.winningCell);
      // Reconcile bets from the server (covers bets placed from another
      // device, or a correction after an optimistic update failed silently).
      const bets: Record<number, number> = {};
      for (const b of state.myBets) bets[b.cellIndex] = b.amount;
      setMyBets(bets);
    }
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

  // Buttery countdown: a requestAnimationFrame loop (not a coarse setInterval)
  // ticking against the server-corrected deadline, so the number counts down
  // every frame instead of in visible 100ms steps.
  useEffect(() => {
    function frame() {
      const deadline = phaseEndsAtRef.current;
      const correctedNow = Date.now() + clockOffsetRef.current;
      setMsLeft(deadline != null ? Math.max(0, deadline - correctedNow) : 0);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const placeBet = useCallback(
    (cellIndex: number) => {
      if (!roomId || selectedBet == null || status !== "BETTING") return;
      if (balance != null && balance < selectedBet) {
        setError({ message: "Not enough coins for that bet." });
        return;
      }
      // Fire the instant, synchronous visual feedback first — the chip, the
      // toss animation, and the balance change all happen on this tick,
      // before the network request even starts. The request below just
      // reconciles the truth once it lands.
      setPlacingCell(cellIndex);
      setMyBets((prev) => ({ ...prev, [cellIndex]: (prev[cellIndex] ?? 0) + selectedBet }));
      setBalance((b) => (b == null ? b : b - selectedBet));
      window.setTimeout(() => {
        if (mounted.current) setPlacingCell((c) => (c === cellIndex ? null : c));
      }, 260); // matches the chip-toss animation duration, not a network wait

      const amount = selectedBet;
      const clientRequestId = newClientRequestId();

      void luckyRingApi
        .bet({ roomId, cellIndex, amount, clientRequestId })
        .then((res) => {
          if (!mounted.current) return;
          setBalance(res.newCoins);
          setMyBets((prev) => ({ ...prev, [cellIndex]: res.totalOnCell }));
        })
        .catch((err) => {
          if (!mounted.current) return;
          // Roll back the optimistic chip on a real rejection.
          setMyBets((prev) => ({ ...prev, [cellIndex]: Math.max(0, (prev[cellIndex] ?? 0) - amount) }));
          setBalance((b) => (b == null ? b : b + amount));
          setError({
            code: err instanceof ApiError ? err.code : undefined,
            message:
              err instanceof ApiError && err.code === "LUCKY_RING_BETTING_CLOSED"
                ? "Betting just closed for this round."
                : "Bet didn't go through — try again.",
          });
          void poll();
        });
    },
    [roomId, selectedBet, status, balance, poll],
  );

  return {
    config,
    status,
    roundId,
    roundNumber,
    phaseEndsAt: phaseEndsAtRef.current,
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