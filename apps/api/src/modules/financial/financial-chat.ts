// File: apps/api/src/modules/financial/financial-chat.ts
//
// Bridges a completed gift transaction into the live room's chat feed.
//
// apps/chat-room/realtime owns no wallet/gift/coin logic at all (see
// apps/chat-room/realtime/src/chat/moderation/gift.ts) — it only relays
// whatever JSON is published on `pubsub:room:<roomId>:chat` to every
// connected socket in that room (subscribeToAllRooms() in
// apps/chat-room/realtime/src/chat/redis/pubsub.ts). Both services point at
// the same REDIS_URL, so publishing directly onto that channel from here is
// enough to make the gift show up in chat in real time — no HTTP call to the
// realtime service, no new endpoint, and the realtime service never sees a
// coin/diamond amount.
//
// This module never mutates a balance and is not on the critical path of
// fin_send_gift(): if the publish fails, the gift itself has already been
// recorded (financial_ledger / host_earnings / agency_commissions), only the
// chat animation/row is skipped.

import { redis } from "../../lib/redis";
import { getChatProfile } from "../users/users.service";
import { getGiftCatalogItem } from "./financial.service";

function pubsubRoomChatChannel(roomId: string): string {
  return `pubsub:room:${roomId}:chat`;
}

export async function publishGiftToRoomChat(input: {
  roomId: string;
  senderId: string;
  giftId: string;
  giftTransactionId: string;
  quantity?: number;
}): Promise<void> {
  try {
    const [sender, gift] = await Promise.all([
      getChatProfile(input.senderId),
      getGiftCatalogItem(input.giftId),
    ]);

    if (!gift) return; // Shouldn't happen (fin_send_gift already validated it), but never throw from here.

    const payload = {
      type: "gift" as const,
      id: `gift-${input.giftTransactionId}`,
      roomId: input.roomId,
      userId: input.senderId,
      username: sender.username,
      avatar: sender.avatar,
      level: sender.level,
      tags: sender.tags,
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCode: gift.code,
      quantity: input.quantity ?? 1,
      createdAt: Date.now(),
    };

    await redis.publish(pubsubRoomChatChannel(input.roomId), JSON.stringify(payload));
  } catch (error) {
    // Best-effort only — never let a chat-relay failure surface as a
    // failed gift send to the client.
    console.error("[financial-chat] failed to publish gift to room chat:", error);
  }
}
