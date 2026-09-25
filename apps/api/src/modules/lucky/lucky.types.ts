// Subha Lucky types (Core API side).
//
// lucky_rounds / fin_lucky_spin post-date the last `supabase gen types` run,
// so these are hand-written (same convention as host-task.types.ts /
// room-task.types.ts / pk.types.ts). Regenerate database.types.ts and swap in
// Tables<"lucky_rounds"> when convenient.

/** Stable symbol identifiers. "lucky" is the wild/jackpot symbol. */
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
  /** Multiplier paid for a 3-of-a-kind line (lucky = jackpot line). */
  multiplier: number;
}

/** A 3x3 board is nine symbol ids, row-major (index 0..8). */
export type LuckyGrid = LuckySymbolId[];

/** One completed spin round as persisted in lucky_rounds. */
export interface LuckyRoundRow {
  id: string;
  user_id: string;
  room_id: string;
  game_type: string;
  bet: number;
  result: LuckyResult;
  multiplier: number;
  payout: number;
  is_jackpot: boolean;
  status: string;
  client_request_id: string;
  config_version: number;
  created_at: string;
}

/**
 * Authoritative spin outcome. Computed server-side, passed to fin_lucky_spin(),
 * persisted in lucky_rounds.result, and returned to the client for rendering.
 */
export interface LuckyResult {
  symbols: LuckyGrid;
  multiplier: number;
  payout: number;
  winningLines: number[][];
  isJackpot: boolean;
}

/** Result of fin_lucky_spin() / the spin service. */
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

/** A recent-result entry for the in-game history strip. */
export interface LuckyRecentResult {
  roundId: string;
  symbols: LuckyGrid;
  multiplier: number;
  payout: number;
  isJackpot: boolean;
  createdAt: string;
}

export interface LuckyPublicConfig {
  configVersion: number;
  gameType: "subha_lucky";
  /** Bets (coins) the player may choose from. */
  bets: number[];
  /** Symbol catalog + paytable (transparent, non-sensitive). */
  symbols: LuckySymbol[];
  /** Line multiplier for 3× Lucky. */
  jackpotMultiplier: number;
  /** Absolute cap on a single spin's payout. */
  maxPayout: number;
}

export interface LuckyStateResponse {
  config: LuckyPublicConfig;
  /** Authoritative current coin balance. */
  balance: number;
  todayWinnings: number;
  recentResults: LuckyRecentResult[];
}

export const LUCKY_GAME_TYPE = "subha_lucky";
export const LUCKY_GRID_SIZE = 9;
