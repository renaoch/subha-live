// File: apps/web/lib/api/lucky.ts
//
// Client for /api/v1/lucky — the Subha Lucky game. The server is the sole
// authority for outcomes; this client only sends a room, a bet and an
// idempotency key, and receives back the authoritative result + new balance.

import { apiFetch } from "@/lib/api/client";
import { newClientRequestId } from "@/lib/api/financial";

interface LuckyEnvelope<T> {
  success: boolean;
  data: T;
}

export type LuckySymbolId =
  | "orange"
  | "lemon"
  | "grapes"
  | "cherry"
  | "apple"
  | "watermelon"
  | "mango"
  | "strawberry"
  | "lucky";

export interface LuckySymbol {
  id: LuckySymbolId;
  name: string;
  multiplier: number;
}

export interface LuckyPublicConfig {
  configVersion: number;
  gameType: "subha_lucky";
  bets: number[];
  symbols: LuckySymbol[];
  jackpotMultiplier: number;
  maxPayout: number;
}

export interface LuckyResult {
  symbols: LuckySymbolId[];
  multiplier: number;
  payout: number;
  winningLines: number[][];
  isJackpot: boolean;
}

export interface LuckySpinResult {
  roundId: string;
  newCoins: number;
  payout: number;
  multiplier: number;
  isJackpot: boolean;
  alreadyProcessed: boolean;
  result: LuckyResult;
  bet: number;
}

export interface LuckyRecentResult {
  roundId: string;
  symbols: LuckySymbolId[];
  multiplier: number;
  payout: number;
  isJackpot: boolean;
  createdAt: string;
}

export interface LuckyStateResponse {
  config: LuckyPublicConfig;
  balance: number;
  todayWinnings: number;
  recentResults: LuckyRecentResult[];
}

export { newClientRequestId };

export const luckyApi = {
  config() {
    return apiFetch<LuckyEnvelope<LuckyPublicConfig>>("/api/v1/lucky/config").then(
      (r) => r.data,
    );
  },

  state(limit = 20) {
    return apiFetch<LuckyEnvelope<LuckyStateResponse>>(
      `/api/v1/lucky/state?limit=${limit}`,
    ).then((r) => r.data);
  },

  spin(input: { roomId: string; bet: number; clientRequestId: string }) {
    return apiFetch<LuckyEnvelope<LuckySpinResult>>("/api/v1/lucky/spin", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  history(limit = 20) {
    return apiFetch<LuckyEnvelope<LuckyRecentResult[]>>(
      `/api/v1/lucky/history?limit=${limit}`,
    ).then((r) => r.data);
  },
};
