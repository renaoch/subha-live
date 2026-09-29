import { setInterval, clearInterval } from "node:timers";
import { randomUUID } from "crypto";
import { luckyRingRedis } from "./lucky-ring.redis";
import { luckyRingService } from "./lucky-ring.service";

const INTERVAL_MS = 1000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically scans the active-room set and advances any round whose
 * current phase (`phaseEndsAt`) has elapsed — BETTING -> SPINNING -> settle
 * -> next BETTING, looping forever while a room stays active. Guarded by a
 * per-room Redis lock so multiple API instances can run this safely, same
 * pattern as modules/quiz/quiz.finalizer.ts / modules/pk/pk.finalizer.ts.
 */
export function startLuckyRingFinalizer(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
}

export function stopLuckyRingFinalizer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  try {
    const active = await luckyRingRedis.listActive();
    const now = Date.now();
    for (const roomId of active) {
      const state = await luckyRingRedis.readState(roomId);
      if (!state) continue;
      if (state.phaseEndsAt == null || state.phaseEndsAt > now) continue;

      const token = randomUUID();
      const locked = await luckyRingRedis.acquireLock(roomId, token, 10);
      if (!locked) continue;
      try {
        await luckyRingService.advancePhase(roomId);
      } catch (error) {
        console.error(`[lucky_ring finalizer] advance failed for ${roomId}:`, error);
      } finally {
        await luckyRingRedis.releaseLock(roomId, token);
      }
    }
  } catch (error) {
    console.error("[lucky_ring finalizer] tick failed:", error);
  }
}