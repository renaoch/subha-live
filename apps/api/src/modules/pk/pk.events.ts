// PK realtime events + publishing. The Core API publishes typed events onto
// Redis pub/sub; the realtime service forwards them to connected WebSocket
// clients (fan-out). The client is never the source of truth.

import { redis } from "../../lib/redis";

export type PkEventType =
  | "PK_INVITE"
  | "PK_ACCEPT"
  | "PK_DECLINE"
  | "PK_START"
  | "PK_STARTED"
  | "PK_TIME_SYNC"
  | "PK_SCORE_UPDATE"
  | "PK_GIFT_EVENT"
  | "PK_ENDING"
  | "PK_END"
  | "PK_ENDED"
  | "PK_RESULT"
  | "PK_CANCEL"
  | "PK_STATE_SYNC";

/** Loose, type-keyed payload — the realtime service forwards it opaquely. */
export type PkEventPayload = { type: PkEventType } & Record<string, unknown>;

export interface PkEvent extends PkEventPayload {
  battleId: string;
  ts: number;
}

const battleChannel = (battleId: string) => `pubsub:pk:${battleId}`;
const hostChannel = (hostId: string) => `pubsub:pkh:${hostId}`;

async function publish(channel: string, event: PkEvent): Promise<void> {
  try {
    await redis.publish(channel, JSON.stringify({ ...event, ts: Date.now() }));
  } catch (error) {
    // Realtime is best-effort; the durable record + Redis state are the truth.
    console.error(`[pk] publish failed for ${event.type}:`, error);
  }
}

export const pkEvents = {
  battleChannel,
  hostChannel,
  /** Publish a battle-scoped event (all viewers of that battle). */
  publishBattle(battleId: string, event: PkEventPayload): Promise<void> {
    return publish(battleChannel(battleId), { ...event, battleId, ts: 0 } as PkEvent);
  },
  /** Publish a host-directed event (invite/accept/decline). */
  publishHost(hostId: string, event: PkEventPayload): Promise<void> {
    return publish(hostChannel(hostId), { ...event, battleId: event.battleId as string, ts: 0 } as PkEvent);
  },
};
