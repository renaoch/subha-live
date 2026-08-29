import { z } from 'zod'

/**
 * Chat implements no economy: no coins, wallets, purchases, gift transactions,
 * or creator earnings. This module only recognizes an externally-produced
 * "gift_event" so that, once an Economy service publishes one (e.g. onto this
 * same room pub/sub channel or a future dedicated channel), Realtime is able
 * to broadcast it to connected clients unchanged. No balances are read or
 * modified here.
 */
export const giftEventSchema = z.object({
  type: z.literal('gift_event'),
  roomId: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type GiftEvent = z.infer<typeof giftEventSchema>

export function isGiftEvent(raw: unknown): raw is GiftEvent {
  return giftEventSchema.safeParse(raw).success
}
