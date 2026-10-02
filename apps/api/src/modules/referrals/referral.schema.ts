import { z } from "zod";

export const applyReferralSchema = z.object({
  code: z.string().min(4).max(16),
});

export type ApplyReferralInput = z.infer<typeof applyReferralSchema>;

export const referralHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});
