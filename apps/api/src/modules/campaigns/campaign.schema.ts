import { z } from "zod";

export const dailyRewardUpdateSchema = z.object({
  rewardCoins: z.number().int().min(0).max(10_000_000),
  rewardXp: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
});

export const dayIndexParamSchema = z.object({
  dayIndex: z.coerce.number().int().min(1).max(365),
});

export const referralSettingsUpdateSchema = z.object({
  rewardCoins: z.number().int().min(0).max(10_000_000),
});

export const promotionUpsertSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240).optional().default(""),
  icon: z.string().min(1).max(40).optional().default("Gift"),
  type: z.enum(["bonus", "event", "milestone"]).optional().default("bonus"),
  rewardCoins: z.number().int().min(0).max(10_000_000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export const promotionIdParamSchema = z.object({
  id: z.string().uuid(),
});
