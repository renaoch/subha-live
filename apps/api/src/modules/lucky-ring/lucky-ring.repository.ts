// Durable Postgres access for Lucky Ring. lucky_ring_* tables/functions
// post-date the generated database.types.ts, so these calls go through an
// untyped view of the client (same convention as lucky.repository.ts /
// pk.repository.ts / quiz.repository.ts).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { LuckyRingMyBet, LuckyRingRecentResult } from "./lucky-ring.types";

const db = supabase as unknown as {
  from: (table: "lucky_ring_rounds" | "lucky_ring_bets") => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

interface FinLuckyRingBetRow {
  new_coins: number;
  total_on_cell: number;
  already_processed: boolean;
}

export const luckyRingRepository = {
  /** Creates the next round row for a room. round_number is caller-supplied
   *  (service layer tracks it via Redis so it doesn't need a read before
   *  every insert). */
  async createRound(input: {
    roomId: string;
    roundNumber: number;
    configVersion: number;
  }): Promise<{ id: string }> {
    const { data, error } = await db
      .from("lucky_ring_rounds")
      .insert({
        room_id: input.roomId,
        round_number: input.roundNumber,
        status: "BETTING",
        config_version: input.configVersion,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new AppError(500, "Failed to create lucky ring round", {
        code: "LUCKY_RING_CREATE_FAILED",
        details: error?.message,
      });
    }
    return { id: String(data.id) };
  },

  /** Atomic, idempotent bet placement — fin_lucky_ring_bet() re-verifies
   *  everything (round is BETTING, balance) and moves the coins. */
  async placeBet(input: {
    userId: string;
    roomId: string;
    roundId: string;
    cellIndex: number;
    amount: number;
    clientRequestId: string;
    configVersion: number;
  }): Promise<{ newCoins: number; totalOnCell: number; alreadyProcessed: boolean }> {
    const { data, error } = await db.rpc("fin_lucky_ring_bet", {
      p_user_id: input.userId,
      p_room_id: input.roomId,
      p_round_id: input.roundId,
      p_cell_index: input.cellIndex,
      p_amount: input.amount,
      p_client_request_id: input.clientRequestId,
      p_config_version: input.configVersion,
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as FinLuckyRingBetRow | null;
    if (!row) {
      throw new AppError(500, "Lucky ring bet did not return a result", {
        code: "LUCKY_RING_BET_FAILED",
      });
    }
    return {
      newCoins: toNumber(row.new_coins),
      totalOnCell: toNumber(row.total_on_cell),
      alreadyProcessed: Boolean(row.already_processed),
    };
  },

  /** Pays every bet on the winning cell and marks the round SETTLED. Safe to
   *  call more than once for the same round (DB-level idempotent no-op). */
  async settleRound(roundId: string, winningCell: number, multiplier: number): Promise<void> {
    const { error } = await db.rpc("fin_lucky_ring_settle_round", {
      p_round_id: roundId,
      p_winning_cell: winningCell,
      p_multiplier: multiplier,
    });
    if (error) {
      throw new AppError(500, "Failed to settle lucky ring round", {
        code: "LUCKY_RING_SETTLE_FAILED",
        details: error.message,
      });
    }
  },

  async getMyBets(roundId: string, userId: string): Promise<LuckyRingMyBet[]> {
    const { data, error } = await db
      .from("lucky_ring_bets")
      .select("cell_index, amount, payout")
      .eq("round_id", roundId)
      .eq("user_id", userId);

    if (error) {
      throw new AppError(500, "Failed to load your bets", { code: "LUCKY_RING_BETS_FAILED" });
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      cellIndex: toNumber(row.cell_index),
      amount: toNumber(row.amount),
      payout: row.payout == null ? null : toNumber(row.payout),
    }));
  },

  async listRecentSettled(roomId: string, limit: number): Promise<LuckyRingRecentResult[]> {
    const { data, error } = await db
      .from("lucky_ring_rounds")
      .select("id, round_number, winning_cell, settled_at")
      .eq("room_id", roomId)
      .eq("status", "SETTLED")
      .order("settled_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(500, "Failed to load recent results", {
        code: "LUCKY_RING_HISTORY_FAILED",
      });
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      roundId: String(row.id),
      roundNumber: toNumber(row.round_number),
      winningCell: toNumber(row.winning_cell),
      settledAt: String(row.settled_at),
    }));
  },

  /** Sum of a user's payouts across rounds settled today, for this room. */
  async todayWinnings(roomId: string, userId: string): Promise<number> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await db
      .from("lucky_ring_bets")
      // Inner-join embed to filter by the parent round's room_id — lucky_ring_bets
      // itself carries no room_id column.
      .select("payout, updated_at, lucky_ring_rounds!inner(room_id)")
      .eq("user_id", userId)
      .eq("lucky_ring_rounds.room_id", roomId)
      .gte("updated_at", startOfToday.toISOString())
      .not("payout", "is", null);

    if (error) {
      throw new AppError(500, "Failed to load today's winnings", {
        code: "LUCKY_RING_WINNINGS_FAILED",
      });
    }
    return ((data ?? []) as Array<{ payout: number }>).reduce(
      (sum, row) => sum + toNumber(row.payout),
      0,
    );
  },

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await (supabase.from("profiles") as any)
      .select("coins")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      throw new AppError(500, "Failed to load balance", { code: "LUCKY_RING_BALANCE_FAILED" });
    }
    return toNumber(data.coins);
  },
};