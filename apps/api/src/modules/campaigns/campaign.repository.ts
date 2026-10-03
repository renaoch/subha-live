// Durable access for campaign configuration. promotions / referral_settings
// post-date the generated types (untyped view); daily_reward_definitions is
// also untyped (same).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

const db = supabase as unknown as { from: (table: string) => any };

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export interface DailyRewardConfig {
  dayIndex: number;
  rewardCoins: number;
  rewardXp: number;
  isActive: boolean;
}

export interface ReferralConfig {
  rewardCoins: number;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: string;
  rewardCoins: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const campaignRepository = {
  async listDailyRewards(): Promise<DailyRewardConfig[]> {
    const { data, error } = await db
      .from("daily_reward_definitions")
      .select("day_index, reward_coins, reward_xp, is_active")
      .order("day_index", { ascending: true });
    if (error) throw new AppError(500, "Failed to load daily rewards", { code: "CAMPAIGN_LOAD_FAILED" });
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      dayIndex: toNumber(r.day_index),
      rewardCoins: toNumber(r.reward_coins),
      rewardXp: toNumber(r.reward_xp),
      isActive: Boolean(r.is_active),
    }));
  },

  async updateDailyReward(dayIndex: number, input: { rewardCoins: number; rewardXp?: number; isActive?: boolean }): Promise<void> {
    const { error } = await db
      .from("daily_reward_definitions")
      .upsert({
        day_index: dayIndex,
        reward_coins: input.rewardCoins,
        reward_xp: input.rewardXp ?? 0,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "day_index" });
    if (error) throw new AppError(500, "Failed to update daily reward", { code: "CAMPAIGN_UPDATE_FAILED", details: error.message });
  },

  async getReferralSettings(): Promise<ReferralConfig> {
    const { data, error } = await db.from("referral_settings").select("reward_coins").eq("id", 1).maybeSingle();
    if (error) return { rewardCoins: 100 };
    return { rewardCoins: toNumber(data?.reward_coins) };
  },

  async updateReferralSettings(rewardCoins: number): Promise<void> {
    const { error } = await db.from("referral_settings").upsert(
      { id: 1, reward_coins: rewardCoins, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) throw new AppError(500, "Failed to update referral settings", { code: "CAMPAIGN_UPDATE_FAILED", details: error.message });
  },

  async listPromotions(activeOnly: boolean): Promise<Promotion[]> {
    let query = db.from("promotions").select("*").order("created_at", { ascending: false });
    if (activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw new AppError(500, "Failed to load promotions", { code: "CAMPAIGN_LOAD_FAILED" });
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      subtitle: String(r.subtitle ?? ""),
      icon: String(r.icon ?? "Gift"),
      type: String(r.type),
      rewardCoins: toNumber(r.reward_coins),
      isActive: Boolean(r.is_active),
      startsAt: (r.starts_at as string | null) ?? null,
      expiresAt: (r.expires_at as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  },

  async upsertPromotion(input: {
    id?: string;
    title: string;
    subtitle: string;
    icon: string;
    type: string;
    rewardCoins: number;
    isActive: boolean;
    startsAt?: string | null;
    expiresAt?: string | null;
  }): Promise<void> {
    if (input.id) {
      const { error } = await db.from("promotions").update({
        title: input.title,
        subtitle: input.subtitle,
        icon: input.icon,
        type: input.type,
        reward_coins: input.rewardCoins,
        is_active: input.isActive,
        starts_at: input.startsAt ?? null,
        expires_at: input.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", input.id);
      if (error) throw new AppError(500, "Failed to update promotion", { code: "CAMPAIGN_UPDATE_FAILED", details: error.message });
    } else {
      const { error } = await db.from("promotions").insert({
        title: input.title,
        subtitle: input.subtitle,
        icon: input.icon,
        type: input.type,
        reward_coins: input.rewardCoins,
        is_active: input.isActive,
        starts_at: input.startsAt ?? null,
        expires_at: input.expiresAt ?? null,
      });
      if (error) throw new AppError(500, "Failed to create promotion", { code: "CAMPAIGN_CREATE_FAILED", details: error.message });
    }
  },

  async deletePromotion(id: string): Promise<void> {
    const { error } = await db.from("promotions").delete().eq("id", id);
    if (error) throw new AppError(500, "Failed to delete promotion", { code: "CAMPAIGN_DELETE_FAILED", details: error.message });
  },

  async getReferralReward(): Promise<number> {
    const settings = await this.getReferralSettings();
    return settings.rewardCoins > 0 ? settings.rewardCoins : 100;
  },
};
