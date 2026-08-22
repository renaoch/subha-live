import { z } from "zod";

export const giftListQuerySchema = z.object({
  direction: z.enum(["incoming", "outgoing"]).default("incoming"),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  offset: z.coerce.number().int().min(0).default(0),
});

export type GiftListQuery = z.infer<typeof giftListQuerySchema>;

export const sendGiftSchema = z.object({
  recipientId: z.string().uuid(),
  giftName: z.string().min(1).max(100),
  giftIcon: z.string().min(1).max(50).default("gift"),
  value: z.coerce.number().int().positive(),
  streamId: z.string().optional(),
});

export type SendGiftInput = z.infer<typeof sendGiftSchema>;