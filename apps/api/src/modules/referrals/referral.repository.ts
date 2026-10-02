// Durable Postgres access for referrals. referral_codes / referrals post-date
// the generated database.types.ts, so calls go through an untyped view (same
// convention as pk.repository.ts).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export const referralRepository = {
  async getExistingCode(userId: string): Promise<string | null> {
    const { data, error } = await db
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return (data?.code as string | null) ?? null;
  },

  /** Inserts a code; throws 23505 on a (rare) code collision so the caller can retry. */
  async createCode(userId: string, code: string): Promise<string> {
    const { data, error } = await db
      .from("referral_codes")
      .insert({ user_id: userId, code })
      .select("code")
      .single();
    if (error) throw error;
    return data.code as string;
  },

  async findReferrerByCode(code: string): Promise<string | null> {
    const { data, error } = await db
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();
    if (error) return null;
    return (data?.user_id as string | null) ?? null;
  },

  async apply(input: {
    referredId: string;
    referrerId: string;
    rewardCoins: number;
  }): Promise<{ referralId: string; referrerCoins: number; alreadyProcessed: boolean }> {
    const { data, error } = await db.rpc("fin_apply_referral", {
      p_referred_id: input.referredId,
      p_referrer_id: input.referrerId,
      p_reward_coins: input.rewardCoins,
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as {
      referral_id?: string;
      referrer_coins?: number;
      already_processed?: boolean;
    };

    return {
      referralId: String(row.referral_id ?? ""),
      referrerCoins: toNumber(row.referrer_coins),
      alreadyProcessed: Boolean(row.already_processed),
    };
  },

  async getOverview(referrerId: string): Promise<{ totalReferrals: number; totalRewardCoins: number }> {
    const { data, error } = await db
      .from("referrals")
      .select("reward_coins")
      .eq("referrer_id", referrerId);

    if (error) {
      throw new AppError(500, "Failed to load referral stats", {
        code: "REFERRAL_STATS_FAILED",
        details: error.message,
      });
    }

    const rows = (data ?? []) as Array<{ reward_coins: number }>;
    return {
      totalReferrals: rows.length,
      totalRewardCoins: rows.reduce((sum, r) => sum + toNumber(r.reward_coins), 0),
    };
  },

  async listRecent(referrerId: string, limit: number) {
    const { data, error } = await db
      .from("referrals")
      .select("id, referred_id, reward_coins, created_at, profiles!referrals_referred_id_fkey(name, avatar)")
      .eq("referrer_id", referrerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(500, "Failed to load referral history", {
        code: "REFERRAL_HISTORY_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const profile = (row.profiles as { name?: string; avatar?: string | null } | null) ?? null;
      return {
        id: String(row.id),
        referredUserId: String(row.referred_id),
        referredName: profile?.name ?? null,
        referredAvatar: profile?.avatar ?? null,
        rewardCoins: toNumber(row.reward_coins),
        createdAt: String(row.created_at),
      };
    });
  },

  async getProfileName(userId: string): Promise<string | null> {
    const { data, error } = await (supabase.from("profiles") as any)
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.name as string | null) ?? null;
  },

  async hasApplied(userId: string): Promise<boolean> {
    const { data, error } = await db
      .from("referrals")
      .select("id")
      .eq("referred_id", userId)
      .maybeSingle();
    if (error) return false;
    return !!data;
  },
};
