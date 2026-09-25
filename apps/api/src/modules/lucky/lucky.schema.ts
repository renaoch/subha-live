import { z } from "zod";

export const luckySpinSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().positive(),
  clientRequestId: z.string().min(8).max(120),
});

export type LuckySpinInput = z.infer<typeof luckySpinSchema>;

export const luckyHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
