// Durable Postgres access for Quiz sessions, using the generic
// game_sessions / game_players / game_results tables (game_type = 'quiz').
// Written at session-create and at finish only — the hot per-question state
// lives in Redis (quiz.redis.ts). See the foundation migration for schema.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { QuizSessionRow } from "./quiz.types";

const db = supabase as unknown as {
  from: (table: string) => any;
};

export const quizRepository = {
  async createSession(input: {
    roomId: string;
    createdBy: string;
    questionCount: number;
  }): Promise<QuizSessionRow> {
    const { data, error } = await db
      .from("game_sessions")
      .insert({
        room_id: input.roomId,
        game_type: "quiz",
        status: "WAITING",
        created_by: input.createdBy,
        config: { questionCount: input.questionCount },
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(500, "Failed to create quiz session", {
        code: "QUIZ_CREATE_FAILED",
        details: error?.message,
      });
    }
    return data as QuizSessionRow;
  },

  async getSession(sessionId: string): Promise<QuizSessionRow | null> {
    const { data, error } = await db
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("game_type", "quiz")
      .maybeSingle();
    if (error) return null;
    return (data as QuizSessionRow | null) ?? null;
  },

  async markStatus(
    sessionId: string,
    status: string,
    extra?: { startedAt?: string; endedAt?: string },
  ): Promise<void> {
    await db
      .from("game_sessions")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(extra?.startedAt ? { started_at: extra.startedAt } : {}),
        ...(extra?.endedAt ? { ended_at: extra.endedAt } : {}),
      })
      .eq("id", sessionId);
  },

  async recordResults(
    sessionId: string,
    results: { userId: string; finalScore: number; rank: number; won: boolean }[],
  ): Promise<void> {
    if (results.length === 0) return;
    const rows = results.map((r) => ({
      session_id: sessionId,
      user_id: r.userId,
      game_type: "quiz",
      final_score: r.finalScore,
      rank: r.rank,
      won: r.won,
    }));
    const { error } = await db.from("game_results").insert(rows);
    if (error) {
      // Non-fatal: the Redis scoreboard already reached every client via the
      // QUIZ_FINISHED event. Losing durable history shouldn't break the game.
      console.error("[quiz] failed to persist game_results:", error.message);
    }
  },

  async upsertPlayer(sessionId: string, userId: string): Promise<void> {
    const { error } = await db
      .from("game_players")
      .upsert(
        { session_id: sessionId, user_id: userId },
        { onConflict: "session_id,user_id", ignoreDuplicates: true },
      );
    if (error) {
      console.error("[quiz] failed to upsert game_players:", error.message);
    }
  },
};
