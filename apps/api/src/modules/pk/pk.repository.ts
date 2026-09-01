// Durable PK persistence (Supabase/Postgres). `pk_battles` / `pk_participants`
// post-date the generated database.types.ts, so these calls go through an
// untyped view of the client and every row is cast back to its real shape.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { PkBattleRow, PkSide, PkStatus, PkWinner } from "./pk.types";

const db = supabase as unknown as {
  from: (table: "pk_battles" | "pk_participants") => any;
};

export interface CreateBattleInput {
  roomAId: string;
  roomBId: string;
  hostAId: string;
  hostBId: string;
  invitedBy: string;
}

export interface FinalizeBattleInput {
  scoreA: number;
  scoreB: number;
  winnerSide: PkWinner;
  winnerHostId: string | null;
  endedAt: string;
}

export const pkRepository = {
  async createBattle(input: CreateBattleInput): Promise<PkBattleRow> {
    const { data, error } = await db
      .from("pk_battles")
      .insert({
        room_a_id: input.roomAId,
        room_b_id: input.roomBId,
        host_a_id: input.hostAId,
        host_b_id: input.hostBId,
        invited_by: input.invitedBy,
        status: "INVITED",
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to create PK battle", {
        code: "PK_CREATE_FAILED",
        details: error.message,
      });
    }
    return data as PkBattleRow;
  },

  async getBattle(battleId: string): Promise<PkBattleRow | null> {
    const { data, error } = await db
      .from("pk_battles")
      .select("*")
      .eq("id", battleId)
      .maybeSingle();
    if (error) {
      throw new AppError(500, "Failed to load PK battle", {
        code: "PK_LOAD_FAILED",
        details: error.message,
      });
    }
    return (data as PkBattleRow | null) ?? null;
  },

  async getBattleOrThrow(battleId: string): Promise<PkBattleRow> {
    const battle = await this.getBattle(battleId);
    if (!battle) {
      throw new AppError(404, "PK battle not found", { code: "PK_NOT_FOUND" });
    }
    return battle;
  },

  /**
   * Transition status, atomically guarded by the expected previous status so
   * concurrent callers cannot double-apply a transition. Returns the updated
   * row, or null if the guard failed (someone else already moved it).
   */
  async transitionStatus(
    battleId: string,
    from: PkStatus | PkStatus[],
    to: PkStatus,
    extra: Record<string, unknown> = {},
  ): Promise<PkBattleRow | null> {
    const fromList = Array.isArray(from) ? from : [from];
    let query = db
      .from("pk_battles")
      .update({ status: to, ...extra })
      .eq("id", battleId)
      .in("status", fromList)
      .select("*");

    const { data, error } = await query.single();
    if (error) {
      // PGRST116 = no row matched the guard.
      if (error.code === "PGRST116") return null;
      throw new AppError(500, "Failed to update PK battle", {
        code: "PK_UPDATE_FAILED",
        details: error.message,
      });
    }
    return data as PkBattleRow;
  },

  async finalize(battleId: string, input: FinalizeBattleInput): Promise<PkBattleRow | null> {
    // Guarded by status ACTIVE/FINALIZING so only one finalizer wins.
    return this.transitionStatus(battleId, ["ACTIVE", "FINALIZING"], "FINISHED", {
      score_a: input.scoreA,
      score_b: input.scoreB,
      winner_side: input.winnerSide,
      winner_host_id: input.winnerHostId,
      ended_at: input.endedAt,
    });
  },

  async upsertParticipant(battleId: string, userId: string, side: PkSide): Promise<void> {
    const { error } = await db.from("pk_participants").upsert(
      { battle_id: battleId, user_id: userId, side, joined_at: new Date().toISOString() },
      { onConflict: "battle_id,user_id" },
    );
    if (error) {
      throw new AppError(500, "Failed to record PK participant", {
        code: "PK_PARTICIPANT_FAILED",
        details: error.message,
      });
    }
  },
};
