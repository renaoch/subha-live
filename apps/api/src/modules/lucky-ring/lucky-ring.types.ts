import type { LuckySymbolId } from "../lucky/lucky.types";

export type LuckyRingStatus = "BETTING" | "SPINNING" | "SETTLED";

/** Live round state, held in Redis (same split as modules/quiz: live state in
 *  Redis, durable economy in Postgres). */
export interface LuckyRingRedisState {
  roundId: string;
  roomId: string;
  roundNumber: number;
  status: LuckyRingStatus;
  /** When the current phase (BETTING or SPINNING) ends. Null once SETTLED. */
  phaseEndsAt: number | null;
  /** Only set once betting closes; withheld from clients until SPINNING. */
  winningCell: number | null;
  configVersion: number;
  version: number;
}

export interface LuckyRingCellPublic {
  index: number;
  symbol: LuckySymbolId;
  multiplier: number;
}

export interface LuckyRingPublicConfig {
  configVersion: number;
  gameType: "lucky_ring";
  bets: number[];
  cells: LuckyRingCellPublic[];
  bettingMs: number;
  spinMs: number;
  maxPayout: number;
}

/** A user's accumulated bet on one cell, this round. */
export interface LuckyRingMyBet {
  cellIndex: number;
  amount: number;
  payout: number | null; // null until settled
}

export interface LuckyRingStateResponse {
  config: LuckyRingPublicConfig;
  roundId: string;
  roundNumber: number;
  status: LuckyRingStatus;
  phaseEndsAt: number | null;
  /** Present only once the round has moved to SPINNING/SETTLED. */
  winningCell: number | null;
  balance: number;
  todayWinnings: number;
  myBets: LuckyRingMyBet[];
  /** Recent settled rounds, most recent first — powers the bottom "Results" strip. */
  recentResults: LuckyRingRecentResult[];
}

export interface LuckyRingRecentResult {
  roundId: string;
  roundNumber: number;
  winningCell: number;
  settledAt: string;
}

export interface LuckyRingBetResult {
  accepted: true;
  newCoins: number;
  cellIndex: number;
  totalOnCell: number;
  alreadyProcessed: boolean;
}

export const LUCKY_RING_REDIS_ACTIVE_TTL_SECONDS = 60 * 30;