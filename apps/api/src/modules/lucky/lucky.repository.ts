// Durable Postgres access for Subha Lucky. lucky_rounds / fin_lucky_spin
// post-date the generated database.types.ts, so these calls go through an
// untyped view of the client and every row is cast back to its real shape
// (same convention as pk.repository.ts / quiz.repository.ts).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type {
  LuckyGrid,
  LuckyRecentResult,
  LuckyResult,
  LuckyRoundRow,
  LuckySpinResult,
} from "./lucky.types";

const db = supabase as unknown as {
  from: (table: "lucky_rounds") => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

interface FinLuckySpinRow {
  round_id: string;
  new_coins: number;
  payout: number;
  multiplier: number;
  is_jackpot: boolean;
  already_processed: boolean;
  /** The authoritative stored result — identical to the input on a fresh
   *  spin, and the ORIGINAL stored result on an idempotent retry. */
  result: unknown;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function parseResult(raw: unknown): LuckyResult {
  const r = (raw ?? {}) as {
    symbols?: LuckyGrid;
    multiplier?: number;
    payout?: number;
    winningLines?: number[][];
    isJackpot?: boolean;
  };
  return {
    symbols: Array.isArray(r.symbols) ? r.symbols : [],
    multiplier: toNumber(r.multiplier),
    payout: toNumber(r.payout),
    winningLines: Array.isArray(r.winningLines) ? r.winningLines : [],
    isJackpot: Boolean(r.isJackpot),
  };
}

export const luckyRepository = {
  /**
   * Atomic, idempotent spin settlement. `result` is the authoritative outcome
   * computed by the service layer — fin_lucky_spin() re-verifies balance and
   * idempotency and moves the coins.
   */
  async spin(input: {
    userId: string;
    roomId: string;
    bet: number;
    clientRequestId: string;
    result: LuckyResult;
    configVersion: number;
  }): Promise<LuckySpinResult> {
    const { data, error } = await db.rpc("fin_lucky_spin", {
      p_user_id: input.userId,
      p_room_id: input.roomId,
      p_bet: input.bet,
      p_client_request_id: input.clientRequestId,
      p_result: input.result,
      p_config_version: input.configVersion,
    });

    if (error) {
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as FinLuckySpinRow | null;
    if (!row) {
      throw new AppError(500, "Lucky spin did not return a result", {
        code: "LUCKY_SPIN_FAILED",
      });
    }

    return {
      roundId: row.round_id,
      newCoins: toNumber(row.new_coins),
      payout: toNumber(row.payout),
      multiplier: toNumber(row.multiplier),
      isJackpot: Boolean(row.is_jackpot),
      alreadyProcessed: Boolean(row.already_processed),
      // On a retry fin_lucky_spin returns the ORIGINAL result, not the new
      // input — the frontend must render what was actually settled.
      result: parseResult(row.result),
      bet: input.bet,
    };
  },

  async listRecent(userId: string, limit: number): Promise<LuckyRecentResult[]> {
    const { data, error } = await db
      .from("lucky_rounds")
      .select("id, result, multiplier, payout, is_jackpot, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(500, "Failed to load lucky history", {
        code: "LUCKY_HISTORY_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      roundId: String(row.id),
      symbols: parseResult(row.result).symbols,
      multiplier: toNumber(row.multiplier),
      payout: toNumber(row.payout),
      isJackpot: Boolean(row.is_jackpot),
      createdAt: String(row.created_at),
    }));
  },

  async todayWinnings(userId: string): Promise<number> {
    // Sum of payouts for rounds created today. The boundary is computed in JS
    // (server-local "today") and compared against the timestamptz created_at —
    // PostgREST does not evaluate SQL expressions in filter values, so we never
    // pass "now()::date" as a literal string.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await db
      .from("lucky_rounds")
      .select("payout")
      .eq("user_id", userId)
      .gte("created_at", startOfToday.toISOString());

    if (error) {
      throw new AppError(500, "Failed to load today's winnings", {
        code: "LUCKY_WINNINGS_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<{ payout: number }>).reduce(
      (sum, row) => sum + toNumber(row.payout),
      0,
    );
  },

  async getBalance(userId: string): Promise<number> {
    // profiles.coins is the single authoritative balance source.
    const { data, error } = await (supabase.from("profiles") as any)
      .select("coins")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      throw new AppError(500, "Failed to load balance", {
        code: "LUCKY_BALANCE_FAILED",
        details: error?.message,
      });
    }
    return toNumber(data.coins);
  },

  async getRoundById(roundId: string): Promise<LuckyRoundRow | null> {
    const { data, error } = await db.from("lucky_rounds").select("*").eq("id", roundId).maybeSingle();
    if (error) return null;
    return (data as LuckyRoundRow | null) ?? null;
  },
};
