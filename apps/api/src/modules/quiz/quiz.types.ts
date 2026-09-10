// Quiz game types (Core API side). Quiz is the first `game_type` on top of
// the generic game_sessions/game_players/game_results tables — see
// supabase/migrations/20260910000000_party_game_foundation.sql. Nothing here
// is Quiz-database-specific; the generic tables just get filtered by
// game_type = 'quiz'.

export type QuizStatus =
  | "WAITING"
  | "COUNTDOWN"
  | "QUESTION_ACTIVE"
  | "QUESTION_RESULT"
  | "GAME_FINISHED"
  | "CANCELLED";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/** What a client is allowed to see *before* the result phase — never the answer. */
export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  options: string[];
}

export interface QuizPlayer {
  userId: string;
  score: number;
  streak: number;
  ready: boolean;
  connected: boolean;
  lastAnsweredIndex: number | null;
}

export interface QuizRedisState {
  sessionId: string;
  roomId: string;
  hostId: string;
  status: QuizStatus;
  questionIndex: number;
  questionCount: number;
  phaseEndsAt: number | null;
  version: number;
}

export interface QuizSessionRow {
  id: string;
  room_id: string;
  game_type: string;
  status: string;
  created_by: string;
  config: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export const QUIZ_COUNTDOWN_MS = 5_000;
export const QUIZ_QUESTION_MS = 15_000;
export const QUIZ_RESULT_MS = 4_000;
export const QUIZ_MIN_PLAYERS = 1;
export const QUIZ_FINISHED_RETENTION_SECONDS = 30 * 60;

export const QUIZ_BASE_POINTS = 100;
export const QUIZ_STREAK_BONUS = 20;
/** Speed bonus: up to +100 for answering instantly, decaying to 0 at the deadline. */
export const QUIZ_MAX_SPEED_BONUS = 100;
