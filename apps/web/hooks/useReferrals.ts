"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  referralsApi,
  type ApplyReferralResult,
  type ReferralEntry,
  type ReferralOverview,
} from "@/lib/api/referrals";

export function useReferrals() {
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [history, setHistory] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyReferralResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ov, h] = await Promise.all([referralsApi.overview(), referralsApi.history(30)]);
      setOverview(ov);
      setHistory(h);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load referrals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(
    async (code: string) => {
      if (applying) return;
      setApplying(true);
      setApplyError(null);
      setApplyResult(null);
      try {
        const result = await referralsApi.apply(code);
        setApplyResult(result);
        await load();
      } catch (err) {
        setApplyError(err instanceof ApiError ? err.message : "Could not apply code.");
      } finally {
        setApplying(false);
      }
    },
    [applying, load],
  );

  return { overview, history, loading, error, applying, applyResult, applyError, apply, reload: load };
}
