// File: apps/web/lib/api/lucky-ring.ts
//
// Client for /api/v1/lucky-ring — the shared-room "Lucky Pro" ring game.
// The server is the sole authority for the round's phase, timer, and the
// winning cell; this client only sends a room, a cell + amount, and an
// idempotency key, and polls back the authoritative round state.

import { apiFetch } from "@/lib/api/client";
import { newClientRequestId } from "@/lib/api/financial";
import type { LuckySymbolId } from "@/lib/api/lucky";

interface LuckyRingEnvelope<T> {
  success: boolean;
  data: T;
}

export type LuckyRingStatus = "BETTING" | "SPINNING" | "SETTLED";

export interface LuckyRingCell {
  index: number;
  symbol: LuckySymbolId;
  multiplier: number;
}

export interface LuckyRingPublicConfig {
  configVersion: number;
  gameType: "lucky_ring";
  bets: number[];
  cells: LuckyRingCell[];
  bettingMs: number;
  spinMs: number;
  maxPayout: number;
}

export interface LuckyRingMyBet {
  cellIndex: number;
  amount: number;
  payout: number | null;
}

export interface LuckyRingRecentResult {
  roundId: string;
  roundNumber: number;
  winningCell: number;
  settledAt: string;
}

export interface LuckyRingStateResponse {
  config: LuckyRingPublicConfig;
  roundId: string;
  roundNumber: number;
  status: LuckyRingStatus;
  phaseEndsAt: number | null;
  winningCell: number | null;
  balance: number;
  todayWinnings: number;
  myBets: LuckyRingMyBet[];
  recentResults: LuckyRingRecentResult[];
}

export interface LuckyRingBetResult {
  newCoins: number;
  totalOnCell: number;
  cellIndex: number;
  alreadyProcessed: boolean;
}

export { newClientRequestId };

export const luckyRingApi = {
  config() {
    return apiFetch<LuckyRingEnvelope<LuckyRingPublicConfig>>("/api/v1/lucky-ring/config").then(
      (r) => r.data,
    );
  },

  state(roomId: string) {
    return apiFetch<LuckyRingEnvelope<LuckyRingStateResponse>>(
      `/api/v1/lucky-ring/state?roomId=${encodeURIComponent(roomId)}`,
    ).then((r) => r.data);
  },

  bet(input: { roomId: string; cellIndex: number; amount: number; clientRequestId: string }) {
    return apiFetch<LuckyRingEnvelope<LuckyRingBetResult>>("/api/v1/lucky-ring/bet", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },
};