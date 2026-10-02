// Durable Postgres access for daily rewards. daily_reward_* tables post-date
// the generated database.types.ts, so calls go through an untyped view (same
// convention as pk.repository.ts).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { DailyRewardClaim, DailyRewardDefinition } from "./daily-reward.types";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export interface StreakRow {
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string | null;
}

export const dailyRewardRepository = {
  async getSchedule(): Promise<DailyRewardDefinition[]> {
    const { data, error } = await db
      .from("daily_reward_definitions")
      .select("day_index, reward_coins, reward_xp, reward_type, is_active")
      .eq("is_active", true)
      .order("day_index", { ascending: true });

    if (error) {
      throw new AppError(500, "Failed to load reward schedule", {
        code: "REWARD_SCHEDULE_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      dayIndex: toNumber(row.day_index),
      rewardCoins: toNumber(row.reward_coins),
      rewardXp: toNumber(row.reward_xp),
      rewardType: (row.reward_type as "coins") ?? "coins",
      isActive: Boolean(row.is_active),
    }));
  },

  async getStreak(userId: string): Promise<StreakRow> {
    const { data, error } = await db
      .from("daily_reward_streaks")
      .select("current_streak, longest_streak, last_claim_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Failed to load reward streak", {
        code: "REWARD_STREAK_FAILED",
        details: error.message,
      });
    }

    return {
      currentStreak: toNumber(data?.current_streak),
      longestStreak: toNumber(data?.longest_streak),
      lastClaimDate: (data?.last_claim_date as string | null) ?? null,
    };
  },

  async listRecentClaims(userId: string, limit: number): Promise<DailyRewardClaim[]> {
    const { data, error } = await db
      .from("daily_reward_claims")
      .select("id, day_index, reward_date, streak, reward_coins, reward_xp, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(500, "Failed to load reward history", {
        code: "REWARD_HISTORY_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      dayIndex: toNumber(row.day_index),
      rewardDate: String(row.reward_date),
      streak: toNumber(row.streak),
      rewardCoins: toNumber(row.reward_coins),
      rewardXp: toNumber(row.reward_xp),
      createdAt: String(row.created_at),
    }));
  },

  async getCoins(userId: string): Promise<number> {
    const { data, error } = await (supabase.from("profiles") as any)
      .select("coins")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return 0;
    return toNumber(data.coins);
  },

  async claim(input: {
    userId: string;
    rewardDate: string;
    dayIndex: number;
    rewardCoins: number;
    rewardXp: number;
  }): Promise<{
    claimId: string;
    newCoins: number;
    newStreak: number;
    alreadyProcessed: boolean;
  }> {
    const { data, error } = await db.rpc("fin_claim_daily_reward", {
      p_user_id: input.userId,
      p_reward_date: input.rewardDate,
      p_day_index: input.dayIndex,
      p_reward_coins: input.rewardCoins,
      p_reward_xp: input.rewardXp,
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as {
      claim_id?: string;
      new_coins?: number;
      new_streak?: number;
      already_processed?: boolean;
    };

    return {
      claimId: String(row.claim_id ?? ""),
      newCoins: toNumber(row.new_coins),
      newStreak: toNumber(row.new_streak),
      alreadyProcessed: Boolean(row.already_processed),
    };
  },
};
