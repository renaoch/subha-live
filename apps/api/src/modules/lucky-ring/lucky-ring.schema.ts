import { z } from "zod";

export const luckyRingBetSchema = z.object({
  roomId: z.string().uuid(),
  cellIndex: z.number().int().min(0).max(9),
  amount: z.number().int().positive(),
  clientRequestId: z.string().min(8).max(120),
});

export type LuckyRingBetInput = z.infer<typeof luckyRingBetSchema>;

export const luckyRingRoomQuerySchema = z.object({
  roomId: z.string().uuid(),
});