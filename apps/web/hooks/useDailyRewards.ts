"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { rewardsApi, type DailyRewardClaimResult, type DailyRewardOverview } from "@/lib/api/rewards";

export function useDailyRewards() {
  const [overview, setOverview] = useState<DailyRewardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [lastResult, setLastResult] = useState<DailyRewardClaimResult | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await rewardsApi.overview();
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load rewards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    setError(null);
    setJustClaimed(false);
    try {
      const result = await rewardsApi.claim();
      setLastResult(result);
      setJustClaimed(!result.alreadyProcessed);
      // Refresh the authoritative overview (calendar, streak, balance).
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Claim failed. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [claiming, load]);

  return { overview, loading, error, claiming, lastResult, justClaimed, claim, reload: load };
}
