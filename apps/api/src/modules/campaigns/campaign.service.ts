// Campaign configuration service (admin CRUD + public read). Authorization is
// enforced per-operation: mutating endpoints require a platform admin; the
// public promotion list is read-only.

import { logAudit } from "../../lib/audit";
import { assertIsPlatformAdmin } from "../financial/financial.service";
import { campaignRepository as repo, type DailyRewardConfig, type Promotion, type ReferralConfig } from "./campaign.repository";

export interface CampaignConfig {
  dailyRewards: DailyRewardConfig[];
  referral: ReferralConfig;
  promotions: Promotion[];
}

async function fetchConfig(): Promise<CampaignConfig> {
  const [dailyRewards, referral, promotions] = await Promise.all([
    repo.listDailyRewards(),
    repo.getReferralSettings(),
    repo.listPromotions(false),
  ]);
  return { dailyRewards, referral, promotions };
}

export const campaignService = {
  async getConfig(adminId: string): Promise<CampaignConfig> {
    await assertIsPlatformAdmin(adminId);
    return fetchConfig();
  },

  /** Public: only active promotions. */
  async getActivePromotions(): Promise<Promotion[]> {
    return repo.listPromotions(true);
  },

  async updateDailyReward(adminId: string, dayIndex: number, input: { rewardCoins: number; rewardXp?: number; isActive?: boolean }): Promise<CampaignConfig> {
    await assertIsPlatformAdmin(adminId);
    await repo.updateDailyReward(dayIndex, input);
    await logAudit({ actorId: adminId, action: "CAMPAIGN_DAILY_REWARD_UPDATED", entityType: "daily_reward_definitions", entityId: String(dayIndex), newValue: input });
    return fetchConfig();
  },

  async updateReferralSettings(adminId: string, rewardCoins: number): Promise<CampaignConfig> {
    await assertIsPlatformAdmin(adminId);
    await repo.updateReferralSettings(rewardCoins);
    await logAudit({ actorId: adminId, action: "CAMPAIGN_REFERRAL_UPDATED", entityType: "referral_settings", entityId: "1", newValue: { rewardCoins } });
    return fetchConfig();
  },

  async upsertPromotion(adminId: string, input: Parameters<typeof repo.upsertPromotion>[0]): Promise<CampaignConfig> {
    await assertIsPlatformAdmin(adminId);
    await repo.upsertPromotion(input);
    await logAudit({ actorId: adminId, action: "CAMPAIGN_PROMOTION_UPSERTED", entityType: "promotions", entityId: input.id ?? null, newValue: input });
    return fetchConfig();
  },

  async deletePromotion(adminId: string, id: string): Promise<CampaignConfig> {
    await assertIsPlatformAdmin(adminId);
    await repo.deletePromotion(id);
    await logAudit({ actorId: adminId, action: "CAMPAIGN_PROMOTION_DELETED", entityType: "promotions", entityId: id });
    return fetchConfig();
  },
};
