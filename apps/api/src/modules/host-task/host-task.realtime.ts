// Realtime event bus for host tasks.
//
// The API publishes typed events onto the same Redis pub/sub namespace the
// live-room realtime service already subscribes to (`pubsub:room:*`). The
// realtime service (apps/chat-room/realtime) forwards these to every
// connected socket in the room; the web client then refetches/updates its
// task card without a page refresh.
//
// Publishing is deliberately best-effort: the durable source of truth is
// Postgres, and the frontend falls back to polling when a socket is
// unavailable. A failed publish must never roll back the business operation
// that triggered it, so every call is wrapped in its own try/catch.

import { redis } from "../../lib/redis";

export type HostTaskEventType =
  | "task.created"
  | "task.updated"
  | "task.enabled"
  | "task.disabled"
  | "task.deleted"
  | "task.expired"
  | "task.progress.updated"
  | "task.completed"
  | "task.claimed";

export interface HostTaskRealtimeEvent {
  type: HostTaskEventType;
  roomId: string;
  taskId: string;
  /** Present on per-user events (progress/completed/claimed). */
  userId?: string;
  /** Lightweight progress snapshot for optimistic UI updates. */
  data?: {
    percent?: number;
    hours?: number;
    coins?: number;
    rewardAmount?: number;
  };
  ts: number;
}

function taskChannel(roomId: string): string {
  return `pubsub:room:${roomId}:task`;
}

/**
 * Publish one task event to the room's task channel. Safe to call from
 * anywhere (including hot gift/claim paths) — it never throws.
 */
export async function publishHostTaskEvent(
  roomId: string,
  event: Omit<HostTaskRealtimeEvent, "roomId" | "ts">,
): Promise<void> {
  const payload: HostTaskRealtimeEvent = {
    ...event,
    roomId,
    ts: Date.now(),
  };

  try {
    await redis.publish(taskChannel(roomId), JSON.stringify(payload));
  } catch (error) {
    // Realtime is best-effort. Pub/sub is unsupported on the Upstash REST
    // backend (only node-redis via REDIS_URL), and a transient Redis blip
    // should never surface as an API error.
    console.error(
      `[host-task:realtime] publish failed for ${event.type}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
