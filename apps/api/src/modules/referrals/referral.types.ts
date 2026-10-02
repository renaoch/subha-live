// Referral types. referral_codes / referrals post-date the last
// `supabase gen types` run, so these are hand-written (same convention as
// host-task.types.ts / pk.types.ts).

export interface ReferralOverview {
  code: string;
  totalReferrals: number;
  totalRewardCoins: number;
  rewardPerReferral: number;
  /** True once this user has already applied someone else's code. */
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
