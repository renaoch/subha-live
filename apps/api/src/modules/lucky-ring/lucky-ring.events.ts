// Lucky Ring realtime events. Same fan-out SHAPE as modules/quiz/quiz.events.ts
// (publish onto Redis pub/sub, intended to be forwarded to room WebSocket
// clients by apps/chat-room/realtime).
//
// NOTE: as of this writing, apps/chat-room/realtime only has gateways for
// `pk` and `chat` (see src/pk/pk.gateway.ts) — there is no `lucky_ring`
// gateway forwarding this channel to browsers yet, the same gap that exists
// for `quiz`. Publishing here costs nothing and makes adding that gateway a
// pure addition later, but until it exists, the frontend hook in
// apps/web/hooks/useLuckyRing.ts drives itself by polling GET /lucky-ring/state
// instead of listening on a socket. Swap that poll for a WebSocket
// subscription once a `lucky_ring` gateway (mirroring pk.gateway.ts) ships.

import { redis } from "../../lib/redis";

export type LuckyRingEventType =
  | "LUCKY_RING_BETTING_OPEN"
  | "LUCKY_RING_BET_PLACED"
  | "LUCKY_RING_SPINNING"
  | "LUCKY_RING_SETTLED";

export type LuckyRingEventPayload = { type: LuckyRingEventType } & Record<string, unknown>;

export interface LuckyRingEvent extends LuckyRingEventPayload {
  roomId: string;
  ts: number;
}

const roomChannel = (roomId: string) => `pubsub:lucky_ring:${roomId}`;

async function publish(channel: string, event: LuckyRingEvent): Promise<void> {
  try {
    await redis.publish(channel, JSON.stringify({ ...event, ts: Date.now() }));
  } catch (error) {
    // Realtime is best-effort; Redis phase state + Postgres economy are the truth.
    console.error(`[lucky_ring] publish failed for ${event.type}:`, error);
  }
}

export const luckyRingEvents = {
  roomChannel,
  publishRoom(roomId: string, event: LuckyRingEventPayload): Promise<void> {
    return publish(roomChannel(roomId), { ...event, roomId, ts: 0 } as LuckyRingEvent);
  },
};