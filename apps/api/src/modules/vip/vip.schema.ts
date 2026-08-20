import { z } from "zod";

export const vipSubscriptionParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Subscription ID is required")
    .max(100, "Subscription ID is too long"),
});

export type VipSubscriptionParams =
  z.infer<typeof vipSubscriptionParamsSchema>;