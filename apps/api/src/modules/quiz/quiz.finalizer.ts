import { setInterval, clearInterval } from "node:timers";
import { randomUUID } from "crypto";
import { quizRedis } from "./quiz.redis";
import { quizService } from "./quiz.service";

const INTERVAL_MS = 1000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically scans the active-session set and advances any session whose
 * current phase (`phaseEndsAt`) has elapsed — countdown -> first question,
 * question -> result, result -> next question or finish. Guarded by a
 * per-session Redis lock so multiple API instances can run this safely,
 * same pattern as modules/pk/pk.finalizer.ts.
 */
export function startQuizFinalizer(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
}

export function stopQuizFinalizer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  try {
    const active = await quizRedis.listActive();
    const now = Date.now();
    for (const sessionId of active) {
      const state = await quizRedis.readState(sessionId);
      if (!state) continue;
      if (state.status !== "COUNTDOWN" && state.status !== "QUESTION_ACTIVE" && state.status !== "QUESTION_RESULT") {
        continue;
      }
      if (state.phaseEndsAt == null || state.phaseEndsAt > now) continue;

      const token = randomUUID();
      const locked = await quizRedis.acquireLock(sessionId, token, 10);
      if (!locked) continue;
      try {
        await quizService.advancePhase(sessionId);
      } catch (error) {
        console.error(`[quiz finalizer] advance failed for ${sessionId}:`, error);
      } finally {
        await quizRedis.releaseLock(sessionId, token);
      }
    }
  } catch (error) {
    console.error("[quiz finalizer] tick failed:", error);
  }
}
