// Quiz game orchestration (Core API). Server-authoritative: the client only
// ever sends "I choose option N"; every transition, score, and the winner
// are computed here. Mirrors modules/pk/pk.service.ts's shape.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { quizRedis } from "./quiz.redis";
import { quizRepository } from "./quiz.repository";
import { quizEvents } from "./quiz.events";
import { drawQuestions } from "./quiz.questions";
import { computeAnswerPoints, computeStreakBonus, computeWinners, isLastQuestion, rankPlayers } from "./quiz.logic";
import {
  QUIZ_COUNTDOWN_MS,
  QUIZ_MIN_PLAYERS,
  QUIZ_QUESTION_MS,
  QUIZ_RESULT_MS,
  type QuizQuestion,
  type QuizQuestionPublic,
  type QuizStatus,
} from "./quiz.types";

interface RoomRef {
  id: string;
  host_id: string;
  status: string;
}

async function getRoomOrThrow(roomId: string): Promise<RoomRef> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, host_id, status")
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  }
  return data as RoomRef;
}

/** Room host, or an active (non-left) participant. */
async function assertRoomMember(room: RoomRef, userId: string): Promise<void> {
  if (room.host_id === userId) return;
  const { data } = await supabase
    .from("room_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (!data) {
    throw new AppError(403, "You must be in this room to do that", {
      code: "QUIZ_NOT_ROOM_MEMBER",
    });
  }
}

function toPublicQuestion(q: QuizQuestion): QuizQuestionPublic {
  return { id: q.id, prompt: q.prompt, options: q.options };
}

function scoreboard(players: Awaited<ReturnType<typeof quizRedis.listPlayers>>) {
  return rankPlayers(players);
}

export const quizService = {
  /** Host (or any current room member) starts a new quiz for the room. */
  async create(roomId: string, userId: string, questionCount = 5): Promise<{ sessionId: string }> {
    const room = await getRoomOrThrow(roomId);
    await assertRoomMember(room, userId);

    const clampedCount = Math.max(1, Math.min(questionCount, 8));
    const session = await quizRepository.createSession({
      roomId,
      createdBy: userId,
      questionCount: clampedCount,
    });

    const questions = drawQuestions(clampedCount);
    await quizRedis.writeQuestions(session.id, questions);
    await quizRedis.writeState(session.id, {
      sessionId: session.id,
      roomId,
      hostId: userId,
      status: "WAITING",
      questionIndex: -1,
      questionCount: questions.length,
      phaseEndsAt: null,
      version: 0,
    });
    await quizRedis.markActive(session.id);

    await quizEvents.publishSession(session.id, { type: "QUIZ_CREATED", roomId, hostId: userId });
    return { sessionId: session.id };
  },

  async join(sessionId: string, userId: string): Promise<void> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });
    if (state.status !== "WAITING") {
      throw new AppError(409, "This quiz has already started", { code: "QUIZ_ALREADY_STARTED" });
    }
    const room = await getRoomOrThrow(state.roomId);
    await assertRoomMember(room, userId);

    await quizRedis.addPlayer(sessionId, userId);
    await quizRepository.upsertPlayer(sessionId, userId);
    await quizEvents.publishSession(sessionId, { type: "QUIZ_PLAYER_JOINED", userId });
  },

  async setReady(sessionId: string, userId: string, ready: boolean): Promise<void> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });
    if (state.status !== "WAITING") {
      throw new AppError(409, "This quiz has already started", { code: "QUIZ_ALREADY_STARTED" });
    }
    await quizRedis.setReady(sessionId, userId, ready);
    await quizEvents.publishSession(sessionId, { type: "QUIZ_PLAYER_READY", userId, ready });
  },

  /** Host explicitly starts the game once enough players are ready. */
  async start(sessionId: string, userId: string): Promise<void> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });
    if (state.hostId !== userId) {
      throw new AppError(403, "Only the host can start the quiz", { code: "QUIZ_NOT_HOST" });
    }
    if (state.status !== "WAITING") {
      throw new AppError(409, "This quiz has already started", { code: "QUIZ_ALREADY_STARTED" });
    }
    const players = await quizRedis.listPlayers(sessionId);
    if (players.length < QUIZ_MIN_PLAYERS) {
      throw new AppError(409, "Not enough players to start", { code: "QUIZ_NOT_ENOUGH_PLAYERS" });
    }

    const phaseEndsAt = Date.now() + QUIZ_COUNTDOWN_MS;
    await quizRedis.setPhase(sessionId, "COUNTDOWN", -1, phaseEndsAt);
    await quizRepository.markStatus(sessionId, "COUNTDOWN", {
      startedAt: new Date().toISOString(),
    });
    await quizEvents.publishSession(sessionId, { type: "QUIZ_COUNTDOWN", phaseEndsAt });
  },

  /** Server-authoritative answer submission — computes score, never trusts the client's. */
  async submitAnswer(
    sessionId: string,
    userId: string,
    questionIndex: number,
    optionIndex: number,
  ): Promise<{ correct: boolean; score: number; streak: number }> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });
    if (state.status !== "QUESTION_ACTIVE" || state.questionIndex !== questionIndex) {
      throw new AppError(409, "This question is no longer active", { code: "QUIZ_QUESTION_CLOSED" });
    }
    if (state.phaseEndsAt != null && Date.now() > state.phaseEndsAt) {
      throw new AppError(409, "Time's up for this question", { code: "QUIZ_QUESTION_CLOSED" });
    }

    const questions = await quizRedis.readQuestions(sessionId);
    const question = questions[questionIndex];
    if (!question) {
      throw new AppError(404, "Question not found", { code: "QUIZ_QUESTION_NOT_FOUND" });
    }
    if (optionIndex < 0 || optionIndex >= question.options.length) {
      throw new AppError(400, "Invalid option", { code: "QUIZ_INVALID_OPTION" });
    }

    const isCorrect = optionIndex === question.correctIndex;
    const remainingMs = state.phaseEndsAt ? Math.max(0, state.phaseEndsAt - Date.now()) : 0;
    const points = computeAnswerPoints(isCorrect, remainingMs, QUIZ_QUESTION_MS); // streak bonus applied after the atomic streak update

    const result = await quizRedis.submitAnswer(sessionId, questionIndex, userId, points, isCorrect);
    if (!result.accepted) {
      if (result.reason === "QUIZ_ALREADY_ANSWERED") {
        throw new AppError(409, "You already answered this question", {
          code: "QUIZ_ALREADY_ANSWERED",
        });
      }
      throw new AppError(403, "You are not a player in this quiz", { code: "QUIZ_NOT_A_PLAYER" });
    }

    // Streak bonus (previous streak, since the Lua script already advanced it)
    // is intentionally simple for v1 — applied on top of the base+speed score
    // for correct answers beyond the first in a row.
    let finalScore = result.score;
    const streakBonus = computeStreakBonus(result.streak);
    if (isCorrect && streakBonus > 0) {
      finalScore = await quizRedis.addScoreBonus(sessionId, userId, streakBonus);
    }

    await quizEvents.publishSession(sessionId, {
      type: "QUIZ_ANSWER_RECEIVED",
      userId,
      questionIndex,
    });

    return { correct: isCorrect, score: finalScore, streak: result.streak };
  },

  async getState(sessionId: string): Promise<{
    status: QuizStatus;
    questionIndex: number;
    questionCount: number;
    phaseEndsAt: number | null;
    question: QuizQuestionPublic | null;
    players: Awaited<ReturnType<typeof quizRedis.listPlayers>>;
  }> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });

    const players = scoreboard(await quizRedis.listPlayers(sessionId));
    let question: QuizQuestionPublic | null = null;
    if (state.status === "QUESTION_ACTIVE" && state.questionIndex >= 0) {
      const questions = await quizRedis.readQuestions(sessionId);
      const q = questions[state.questionIndex];
      question = q ? toPublicQuestion(q) : null;
    }

    return {
      status: state.status,
      questionIndex: state.questionIndex,
      questionCount: state.questionCount,
      phaseEndsAt: state.phaseEndsAt,
      question,
      players,
    };
  },

  async cancel(sessionId: string, userId: string): Promise<void> {
    const state = await quizRedis.readState(sessionId);
    if (!state) throw new AppError(404, "Quiz session not found", { code: "QUIZ_NOT_FOUND" });
    if (state.hostId !== userId) {
      throw new AppError(403, "Only the host can cancel the quiz", { code: "QUIZ_NOT_HOST" });
    }
    await quizRedis.setPhase(sessionId, "CANCELLED", state.questionIndex, null);
    await quizRedis.markInactive(sessionId);
    await quizRepository.markStatus(sessionId, "CANCELLED", {
      endedAt: new Date().toISOString(),
    });
    await quizEvents.publishSession(sessionId, { type: "QUIZ_CANCELLED" });
  },

  // ---------------------------------------------------------------------
  // Internal: called only by quiz.finalizer.ts's timer tick, never a route.
  // ---------------------------------------------------------------------

  async advancePhase(sessionId: string): Promise<void> {
    const state = await quizRedis.readState(sessionId);
    if (!state) return;

    if (state.status === "COUNTDOWN") {
      await this._enterQuestion(sessionId, 0, state.questionCount);
      return;
    }

    if (state.status === "QUESTION_ACTIVE") {
      const phaseEndsAt = Date.now() + QUIZ_RESULT_MS;
      await quizRedis.setPhase(sessionId, "QUESTION_RESULT", state.questionIndex, phaseEndsAt);
      const questions = await quizRedis.readQuestions(sessionId);
      const question = questions[state.questionIndex];
      await quizEvents.publishSession(sessionId, {
        type: "QUIZ_QUESTION_RESULT",
        questionIndex: state.questionIndex,
        correctIndex: question?.correctIndex ?? -1,
        players: scoreboard(await quizRedis.listPlayers(sessionId)),
      });
      return;
    }

    if (state.status === "QUESTION_RESULT") {
      if (isLastQuestion(state.questionIndex, state.questionCount)) {
        await this._finish(sessionId, state.questionCount);
      } else {
        await this._enterQuestion(sessionId, state.questionIndex + 1, state.questionCount);
      }
      return;
    }
  },

  async _enterQuestion(sessionId: string, index: number, questionCount: number): Promise<void> {
    const phaseEndsAt = Date.now() + QUIZ_QUESTION_MS;
    await quizRedis.setPhase(sessionId, "QUESTION_ACTIVE", index, phaseEndsAt);
    const questions = await quizRedis.readQuestions(sessionId);
    const question = questions[index];
    await quizEvents.publishSession(sessionId, {
      type: "QUIZ_QUESTION",
      questionIndex: index,
      questionCount,
      phaseEndsAt,
      question: question ? toPublicQuestion(question) : null,
    });
  },

  async _finish(sessionId: string, questionCount: number): Promise<void> {
    const players = scoreboard(await quizRedis.listPlayers(sessionId));
    await quizRedis.setPhase(sessionId, "GAME_FINISHED", questionCount - 1, null);
    await quizRedis.markInactive(sessionId);
    await quizRedis.expireState(sessionId, questionCount);

    const winners = computeWinners(players);
    const results = players.map((p, i) => ({
      userId: p.userId,
      finalScore: p.score,
      rank: i + 1,
      won: winners.has(p.userId),
    }));
    await quizRepository.recordResults(sessionId, results);
    await quizRepository.markStatus(sessionId, "FINISHED", {
      endedAt: new Date().toISOString(),
    });

    await quizEvents.publishSession(sessionId, { type: "QUIZ_FINISHED", players });
  },
};
