// File: apps/web/lib/api/referrals.ts
//
// Client for the referral system. The server resolves the referrer from the
// code and grants the reward atomically — this client only reads the overview
// and issues a code apply.

import { apiFetch } from "@/lib/api/client";

interface ReferralsEnvelope<T> {
  success: boolean;
  data: T;
}

export interface ReferralOverview {
  code: string;
  totalReferrals: number;
  totalRewardCoins: number;
  rewardPerReferral: number;
  alreadyApplied: boolean;
}

export interface ReferralEntry {
  id: string;
  referredUserId: string;
  referredName: string | null;
  referredAvatar: string | null;
  rewardCoins: number;
  createdAt: string;
}

export interface ApplyReferralResult {
  alreadyProcessed: boolean;
  referralId: string;
  rewardCoins: number;
  referrerId: string;
  referrerName: string | null;
}

export const referralsApi = {
  overview() {
    return apiFetch<ReferralsEnvelope<ReferralOverview>>("/api/v1/referrals").then(
      (r) => r.data,
    );
  },

  apply(code: string) {
    return apiFetch<ReferralsEnvelope<ApplyReferralResult>>("/api/v1/referrals/apply", {
      method: "POST",
      body: JSON.stringify({ code }),
    }).then((r) => r.data);
  },

  history(limit = 30) {
    return apiFetch<ReferralsEnvelope<ReferralEntry[]>>(
      `/api/v1/referrals/history?limit=${limit}`,
    ).then((r) => r.data);
  },
};
