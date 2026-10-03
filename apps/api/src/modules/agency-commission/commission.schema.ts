import { z } from "zod";

export const setRateSchema = z.object({
  commissionRate: z.number().int().min(0).max(100),
});

export type SetRateInput = z.infer<typeof setRateSchema>;

export const commissionAgencyIdSchema = z.object({
  agencyId: z.string().min(1).max(64),
});
