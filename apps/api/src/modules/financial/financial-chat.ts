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

// Mirrors apps/chat-room/realtime/src/chat/redis/keys.ts#bucket and
// buckets.ts#bucketStart exactly (same Redis instance, same key shape).
// Kept as a small local copy rather than an import because the two are
// separate deployables — see the module comment above for why this
// service never calls into realtime over HTTP.
function chatBucketKey(roomId: string, bucketStartMs: number): string {
  return `chat:room:${roomId}:bucket:${bucketStartMs}`;
}

const CHAT_BUCKET_SIZE_MS = Number(process.env.CHAT_BUCKET_SIZE_MINUTES ?? 5) * 60_000;
const CHAT_REDIS_RETENTION_SECONDS = Number(process.env.CHAT_REDIS_RETENTION_MINUTES ?? 60) * 60;

/**
 * Write the gift row into the same "hot history" Redis bucket that
 * ChatService#getHistory reads from (see chat/redis/buckets.ts +
 * chat.service.ts#hotOrSingleFlight in apps/chat-room/realtime).
 *
 * Without this, a gift was only ever delivered to sockets that happened
 * to be connected at the exact moment it was published — anyone who
 * refreshed the page, or opened the room a minute later, called
 * GET /rooms/:roomId/chat/history and got back a feed with the gift
 * missing, even though the coin/diamond transfer itself succeeded.
 */
async function addGiftToHotHistory(roomId: string, message: Record<string, unknown>): Promise<void> {
  const createdAt = message.createdAt as number;
  const bucketStart = Math.floor(createdAt / CHAT_BUCKET_SIZE_MS) * CHAT_BUCKET_SIZE_MS;
  const key = chatBucketKey(roomId, bucketStart);
  // IMPORTANT: apps/api's redis client is node-redis or @upstash/redis
  // (see lib/redis.ts), NOT ioredis. Both of those take XADD's field/value
  // pairs as a single object (`{ payload: ... }`), unlike ioredis's
  // variadic ('payload', value) form used over in
  // apps/chat-room/realtime/src/chat/redis/buckets.ts (a separate service
  // on ioredis) — same Redis Stream, same "payload" field name, different
  // client library calling convention.
  await redis.xadd(key, "*", { payload: JSON.stringify(message) });
  await redis.expire(key, CHAT_REDIS_RETENTION_SECONDS);
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
      // `type` drives the LIVE websocket envelope (useRoomChat.ts checks
      // `msg.type === "gift"`); `kind` + `gift` mirror the shape
      // RoomChatMessage already expects out of persisted/history rows
      // (see apps/web/lib/api/chat.ts). Both live on the same object so
      // one write serves both paths.
      type: "gift" as const,
      kind: "gift" as const,
      id: `gift-${input.giftTransactionId}`,
      roomId: input.roomId,
      userId: input.senderId,
      username: sender.username,
      avatar: sender.avatar,
      level: sender.level,
      tags: sender.tags,
      message: "",
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCode: gift.code,
      quantity: input.quantity ?? 1,
      createdAt: Date.now(),
      gift: {
        giftId: gift.id,
        name: gift.name,
        icon: gift.icon,
        code: gift.code,
        quantity: input.quantity ?? 1,
      },
    };

    // Order matters: write to hot history first, then publish. If publish
    // fails after the bucket write, a reconnect/refresh still recovers the
    // gift; the reverse order could let a live viewer see it while a
    // concurrent history fetch still misses it.
    await addGiftToHotHistory(input.roomId, payload);
    await redis.publish(pubsubRoomChatChannel(input.roomId), JSON.stringify(payload));
  } catch (error) {
    // Best-effort only — never let a chat-relay failure surface as a
    // failed gift send to the client.
    console.error("[financial-chat] failed to publish gift to room chat:", error);
  }
}
