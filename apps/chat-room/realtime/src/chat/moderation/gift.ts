import { z } from 'zod'

/**
 * Chat implements no economy: no coins, wallets, purchases, gift transactions,
 * or creator earnings. All of that lives in apps/api's financial module
 * (financial.service.ts -> fin_send_gift() -> financial_ledger /
 * host_earnings / agency_commissions).
 *
 * Once a gift transaction there completes, apps/api publishes a
 * `type: "gift"` message directly onto this room's existing chat pub/sub
 * channel (`pubsub:room:<roomId>:chat`, see redis/keys.ts) using the exact
 * same Redis instance. Realtime's subscribeToAllRooms() forwards whatever
 * is published on that channel to every connected socket unchanged — it
 * does not need to understand the payload, only the `type` field is used
 * by clients to render it differently from a normal chat row. This module
 * exists purely to validate that shape defensively if it is ever consumed
 * server-side (e.g. for moderation/logging), not to gate delivery.
 */
export const giftEventSchema = z.object({
  type: z.literal('gift'),
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  username: z.string(),
  avatar: z.string().nullable().optional(),
  level: z.number().optional(),
  tags: z.array(z.string()).optional(),
  giftId: z.string(),
  giftName: z.string(),
  giftIcon: z.string().nullable().optional(),
  giftCode: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  createdAt: z.number(),
})

export type GiftEvent = z.infer<typeof giftEventSchema>

export function isGiftEvent(raw: unknown): raw is GiftEvent {
  return giftEventSchema.safeParse(raw).success
}
