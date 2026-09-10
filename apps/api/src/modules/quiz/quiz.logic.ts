// Pure Quiz logic — no I/O, unit-tested. Mirrors modules/pk/pk.logic.ts:
// these functions are the single source of truth for scoring/ranking rules.
// The atomic Lua scripts in quiz.redis.ts (SUBMIT_ANSWER_SCRIPT,
// ADD_BONUS_SCRIPT) implement the SAME base-score rule in Redis; keep them
// in sync with `computeAnswerPoints` below.

import {
  QUIZ_BASE_POINTS,
  QUIZ_MAX_SPEED_BONUS,
  QUIZ_QUESTION_MS,
  QUIZ_STREAK_BONUS,
} from "./quiz.types";

/**
 * Points for one answer: base points for a correct answer, plus a speed
 * bonus that decays linearly from QUIZ_MAX_SPEED_BONUS (answered instantly)
 * to 0 (answered right at the deadline). Zero for an incorrect answer.
 */
export function computeAnswerPoints(
  isCorrect: boolean,
  remainingMs: number,
  questionDurationMs: number = QUIZ_QUESTION_MS,
): number {
  if (!isCorrect) return 0;
  const clampedRemaining = Math.max(0, Math.min(remainingMs, questionDurationMs));
  const speedBonus = Math.round((clampedRemaining / questionDurationMs) * QUIZ_MAX_SPEED_BONUS);
  return QUIZ_BASE_POINTS + speedBonus;
}

/**
 * Bonus applied on top of a correct answer's points once the streak extends
 * beyond the first hit in a row (streak=1 -> no bonus yet, streak=2 -> one
 * bonus increment, etc).
 */
export function computeStreakBonus(streakAfterThisAnswer: number): number {
  if (streakAfterThisAnswer <= 1) return 0;
  return (streakAfterThisAnswer - 1) * QUIZ_STREAK_BONUS;
}

/** Next streak value given whether this answer was correct. */
export function nextStreak(previousStreak: number, isCorrect: boolean): number {
  return isCorrect ? previousStreak + 1 : 0;
}

export interface RankablePlayer {
  userId: string;
  score: number;
}

/** Highest score first; ties keep original relative order (stable sort). */
export function rankPlayers<T extends RankablePlayer>(players: T[]): T[] {
  return [...players]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score || a.i - b.i)
    .map(({ p }) => p);
}

/** A player "won" if their score is the top score and the top score is > 0. */
export function computeWinners<T extends RankablePlayer>(rankedPlayers: T[]): Set<string> {
  const topScore = rankedPlayers[0]?.score ?? 0;
  if (topScore <= 0) return new Set();
  return new Set(rankedPlayers.filter((p) => p.score === topScore).map((p) => p.userId));
}

export function isLastQuestion(questionIndex: number, questionCount: number): boolean {
  return questionIndex + 1 >= questionCount;
}
