// hooks/useLucky.ts
//
// Client state for the Subha Lucky game. The server is the sole authority for
// outcomes and balance; this hook only renders + drives that. Idempotency is
// handled the same way as gift-sending: one clientRequestId per logical spin,
// reused on retry (network failure) so a lost response can never cause a
// double spin, and cleared once the server gives a definitive answer.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  luckyApi,
  newClientRequestId,
  type LuckyPublicConfig,
  type LuckyRecentResult,
  type LuckySpinResult,
} from "@/lib/api/lucky";

export type LuckyPhase = "idle" | "spinning" | "revealing";

export interface LuckyError {
  code?: string;
  message: string;
  /** True when retrying with the same request id is safe (network/5xx). */
  retryable: boolean;
}

export function useLucky(roomId: string) {
  const [config, setConfig] = useState<LuckyPublicConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [todayWinnings, setTodayWinnings] = useState(0);
  const [recentResults, setRecentResults] = useState<LuckyRecentResult[]>([]);
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [phase, setPhase] = useState<LuckyPhase>("idle");
  const [result, setResult] = useState<LuckySpinResult | null>(null);
  const [error, setError] = useState<LuckyError | null>(null);

  // One idempotency key per logical spin; kept across retries until a
  // definitive server answer, then cleared.
  const pendingRequestId = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadState = useCallback(async () => {
    try {
      const state = await luckyApi.state(20);
      if (!mounted.current) return;
      setConfig(state.config);
      setBalance(state.balance);
      setTodayWinnings(state.todayWinnings);
      setRecentResults(state.recentResults);
      setSelectedBet((prev) => prev ?? state.config.bets[0] ?? null);
    } catch (err) {
      if (!mounted.current) return;
      setError({
        code: err instanceof ApiError ? err.code : undefined,
        message: "Couldn't load the game. Please try again.",
        retryable: true,
      });
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const spin = useCallback(async () => {
    if (phase === "spinning") return;
    if (selectedBet == null || !roomId) return;

    const clientRequestId = pendingRequestId.current ?? newClientRequestId();
    pendingRequestId.current = clientRequestId;

    setError(null);
    setResult(null);
    setPhase("spinning");

    try {
      const res = await luckyApi.spin({ roomId, bet: selectedBet, clientRequestId });
      pendingRequestId.current = null; // definitive answer — clear for next spin
      if (!mounted.current) return;
      setBalance(res.newCoins);
      setTodayWinnings((w) => w + res.payout);
      setRecentResults((prev) => [
        {
          roundId: res.roundId,
          symbols: res.result.symbols,
          multiplier: res.multiplier,
          payout: res.payout,
          isJackpot: res.isJackpot,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
      setResult(res);
      setPhase("revealing");
    } catch (err) {
      if (!mounted.current) return;
      const retryable = !(err instanceof ApiError) || err.status >= 500 || err.code === "RATE_LIMITED";
      if (retryable) {
        // Uncertain / transient: keep the request id so a retry is idempotent.
        pendingRequestId.current = clientRequestId;
      } else {
        pendingRequestId.current = null;
      }
      setError({
        code: err instanceof ApiError ? err.code : undefined,
        message:
          err instanceof ApiError ? err.message : "Network error — please retry.",
        retryable,
      });
      setPhase("idle");
    }
  }, [phase, selectedBet, roomId]);

  const finishReveal = useCallback(() => {
    setPhase("idle");
  }, []);

  const bets = useMemo(() => config?.bets ?? [], [config]);

  return {
    config,
    balance,
    todayWinnings,
    recentResults,
    selectedBet,
    bets,
    setSelectedBet,
    phase,
    result,
    error,
    spin,
    finishReveal,
    retry: spin,
    reload: loadState,
  };
}
