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
  // Legacy: ties a gift to the old `streams` table (text id).
  streamId: z.string().optional(),
  // New: ties a gift to a live room (uuid, `rooms` table). When set and
  // that room has an active task/goal, the gift's value is added to it
  // automatically. Separate column from streamId — different table,
  // different id type, don't conflate them.
  roomId: z.string().uuid().optional(),
});

export type SendGiftInput = z.infer<typeof sendGiftSchema>;