import { setInterval, clearInterval } from "node:timers";
import { pkRedis } from "./pk.redis";
import { pkService } from "./pk.service";

const INTERVAL_MS = 1000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically scans the active-battle set and finalizes any battle whose
 * `endsAt` has passed. Finalization is idempotent and guarded by a Redis lock,
 * so multiple API instances may run this scheduler safely.
 */
export function startPkFinalizer(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
}

export function stopPkFinalizer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  try {
    const active = await pkRedis.listActive();
    const now = Date.now();
    for (const battleId of active) {
      const state = await pkRedis.readState(battleId);
      if (!state || state.status !== "ACTIVE") continue;
      if (state.endsAt != null && state.endsAt <= now) {
        try {
          await pkService.finalize(battleId);
        } catch (error) {
          console.error(`[pk finalizer] finalize failed for ${battleId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("[pk finalizer] tick failed:", error);
  }
}
