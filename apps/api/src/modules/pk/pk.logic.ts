// Pure PK logic — no I/O, unit-tested. These functions are the single source
// of truth for winner/side determination and the score-application rules. The
// atomic Lua script in pk.redis.ts (ADD_SCORE_SCRIPT) implements the SAME
// score-application rules in Redis; keep the two in sync.

import type { PkSide, PkStatus, PkWinner } from "./pk.types";

/** Determine the winner from final scores. Equal scores => explicit DRAW. */
export function winnerOf(scoreA: number, scoreB: number): PkWinner {
  if (scoreA === scoreB) return "DRAW";
  return scoreA > scoreB ? "A" : "B";
}

/** Which side a host plays in a battle. */
export function sideOf(hostA: string, hostB: string, hostId: string): PkSide {
  return hostA === hostId ? "A" : "B";
}

/** The winning host id, or null for a draw. */
export function winnerHostId(hostA: string, hostB: string, winner: PkWinner): string | null {
  if (winner === "A") return hostA;
  if (winner === "B") return hostB;
  return null;
}

/** Remaining ms until `endsAt` (clamped to >= 0); null if no end. */
export function computeRemainingMs(endsAt: number | null, now: number): number | null {
  if (endsAt == null) return null;
  return Math.max(0, endsAt - now);
}

export interface ScoreModel {
  status: PkStatus;
  scoreA: number;
  scoreB: number;
  version: number;
  /** Gift transaction ids already counted (idempotency set). */
  seenGiftIds: Set<string>;
}

export type ScoreApplyResult =
  | { applied: true; scoreA: number; scoreB: number; version: number }
  | { applied: false; reason: "duplicate" | "not_active" };

/**
 * Apply one gift's score to a side — the exact rules the Lua script encodes:
 *   1. only when ACTIVE;
 *   2. a gift transaction id may be counted at most once (idempotent);
 *   3. increment the side's score and the version (integer arithmetic only).
 */
export function applyScore(model: ScoreModel, side: PkSide, giftTxId: string, delta: number): ScoreApplyResult {
  if (model.status !== "ACTIVE") return { applied: false, reason: "not_active" };
  if (model.seenGiftIds.has(giftTxId)) return { applied: false, reason: "duplicate" };
  model.seenGiftIds.add(giftTxId);
  if (side === "A") model.scoreA += delta;
  else model.scoreB += delta;
  model.version += 1;
  return { applied: true, scoreA: model.scoreA, scoreB: model.scoreB, version: model.version };
}
