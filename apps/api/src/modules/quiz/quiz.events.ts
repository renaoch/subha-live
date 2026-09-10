// Quiz realtime events + publishing. Same fan-out pattern as
// modules/pk/pk.events.ts: the Core API publishes onto Redis pub/sub, and
// the realtime service (apps/chat-room/realtime) forwards to connected
// WebSocket clients in the room. No second websocket/event system.

import { redis } from "../../lib/redis";

export type QuizEventType =
  | "QUIZ_CREATED"
  | "QUIZ_PLAYER_JOINED"
  | "QUIZ_PLAYER_READY"
  | "QUIZ_COUNTDOWN"
  | "QUIZ_QUESTION"
  | "QUIZ_ANSWER_RECEIVED"
  | "QUIZ_QUESTION_RESULT"
  | "QUIZ_FINISHED"
  | "QUIZ_CANCELLED";

export type QuizEventPayload = { type: QuizEventType } & Record<string, unknown>;

export interface QuizEvent extends QuizEventPayload {
  sessionId: string;
  ts: number;
}

const sessionChannel = (sessionId: string) => `pubsub:quiz:${sessionId}`;

async function publish(channel: string, event: QuizEvent): Promise<void> {
  try {
    await redis.publish(channel, JSON.stringify({ ...event, ts: Date.now() }));
  } catch (error) {
    // Realtime is best-effort; Redis state + Postgres results are the truth.
    console.error(`[quiz] publish failed for ${event.type}:`, error);
  }
}

export const quizEvents = {
  sessionChannel,
  publishSession(sessionId: string, event: QuizEventPayload): Promise<void> {
    return publish(sessionChannel(sessionId), { ...event, sessionId, ts: 0 } as QuizEvent);
  },
};
