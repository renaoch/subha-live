import { z } from "zod";

export const giftListQuerySchema = z.object({
  direction: z.enum(["incoming", "outgoing"]).default("incoming"),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  offset: z.coerce.number().int().min(0).default(0),
});

export type GiftListQuery = z.infer<typeof giftListQuerySchema>;

// SECURITY: the client supplies only WHO (recipientId), WHICH gift
// (giftId, a row in gift_catalog), and an idempotency key. It never
// supplies giftName/giftIcon/value/price anymore — those are looked up
// server-side in financial.service.ts#sendGiftTransaction from the gift
// catalog, so a tampered client can no longer charge itself less or
// credit the recipient more than the real price. This replaces the old
// `value: z.coerce.number()...` field, which let the client dictate its
// own price/diamond payout.
export const sendGiftSchema = z.object({
  recipientId: z.string().uuid(),
  giftId: z.string().uuid(),
  // Legacy: ties a gift to the old `streams` table (text id).
  streamId: z.string().optional(),
  // New: ties a gift to a live room (uuid, `rooms` table). When set and
  // that room has an active task/goal, the gift's value is added to it
  // automatically. Separate column from streamId — different table,
  // different id type, don't conflate them.
  roomId: z.string().uuid().optional(),
  // Required: generate once per user tap and resend the SAME value on
  // retry. This is what makes double-taps/duplicate requests safe — see
  // fin_send_gift()'s unique(sender_id, client_request_id) guarantee.
  clientRequestId: z.string().min(8).max(128),
});

export type SendGiftInput = z.infer<typeof sendGiftSchema>;