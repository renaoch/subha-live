import { z } from "zod";

export const dailyRewardHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});
