// Redis access for Quiz sessions (Core API side). Mirrors modules/pk/pk.redis.ts:
// the live game state (current question, timers, scoreboard) lives in Redis;
// Postgres only gets written at session-create and at finish (durable
// history), per the "don't write every realtime event to Postgres" rule.

import { redis } from "../../lib/redis";
import {
  QUIZ_FINISHED_RETENTION_SECONDS,
  type QuizQuestion,
  type QuizRedisState,
  type QuizStatus,
} from "./quiz.types";

export const quizKeys = {
  state: (sessionId: string) => `quiz:${sessionId}:state`,
  players: (sessionId: string) => `quiz:${sessionId}:players`,
  questions: (sessionId: string) => `quiz:${sessionId}:questions`,
  answered: (sessionId: string, questionIndex: number) =>
    `quiz:${sessionId}:answered:${questionIndex}`,
  lock: (sessionId: string) => `quiz:${sessionId}:lock`,
  activeSet: () => "quiz:active",
};

// ---------------------------------------------------------------------------
// Atomic answer submission: validates the question hasn't already been
// answered by this player, computes score server-side, and updates the
// player hash in one round trip. Never trust a client-computed score.
// ---------------------------------------------------------------------------
const SUBMIT_ANSWER_SCRIPT = `
local answeredKey = KEYS[1]
local playersKey = KEYS[2]
local userId = ARGV[1]
local pointsToAward = tonumber(ARGV[2])
local isCorrect = ARGV[3]
local questionIndex = ARGV[4]

local added = redis.call("SADD", answeredKey, userId)
if added == 0 then
  return redis.error_reply("QUIZ_ALREADY_ANSWERED")
end

local raw = redis.call("HGET", playersKey, userId)
if not raw then
  return redis.error_reply("QUIZ_NOT_A_PLAYER")
end

local player = cjson.decode(raw)
local newStreak = 0
if isCorrect == "1" then
  newStreak = (player.streak or 0) + 1
  player.score = (player.score or 0) + pointsToAward
else
  newStreak = 0
end
player.streak = newStreak
player.lastAnsweredIndex = tonumber(questionIndex)
redis.call("HSET", playersKey, userId, cjson.encode(player))

return { player.score, newStreak }
`;

// Adds a streak bonus on top of a score already written by SUBMIT_ANSWER_SCRIPT.
// Split into a second atomic step because the streak length (and therefore
// the bonus) is only known once the first script has advanced it.
const ADD_BONUS_SCRIPT = `
local playersKey = KEYS[1]
local userId = ARGV[1]
local bonus = tonumber(ARGV[2])

local raw = redis.call("HGET", playersKey, userId)
if not raw then
  return redis.error_reply("QUIZ_NOT_A_PLAYER")
end
local player = cjson.decode(raw)
player.score = (player.score or 0) + bonus
redis.call("HSET", playersKey, userId, cjson.encode(player))
return player.score
`;

const LOCK_SCRIPT = `
local ok = redis.call("SET", KEYS[1], ARGV[1], "NX", "EX", ARGV[2])
if ok then return 1 else return 0 end
`;
const UNLOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export const quizRedis = {
  async writeState(sessionId: string, state: QuizRedisState): Promise<void> {
    await redis.hset(quizKeys.state(sessionId), {
      sessionId: state.sessionId,
      roomId: state.roomId,
      hostId: state.hostId,
      status: state.status,
      questionIndex: String(state.questionIndex),
      questionCount: String(state.questionCount),
      phaseEndsAt: state.phaseEndsAt != null ? String(state.phaseEndsAt) : "",
      version: String(state.version),
    });
  },

  async readState(sessionId: string): Promise<QuizRedisState | null> {
    const raw = await redis.hgetall(quizKeys.state(sessionId));
    if (!raw || Object.keys(raw).length === 0) return null;
    return {
      sessionId: raw.sessionId ?? sessionId,
      roomId: raw.roomId ?? "",
      hostId: raw.hostId ?? "",
      status: (raw.status as QuizStatus) ?? "WAITING",
      questionIndex: toNumber(raw.questionIndex),
      questionCount: toNumber(raw.questionCount),
      phaseEndsAt: raw.phaseEndsAt ? toNumber(raw.phaseEndsAt) : null,
      version: toNumber(raw.version),
    };
  },

  async setPhase(
    sessionId: string,
    status: QuizStatus,
    questionIndex: number,
    phaseEndsAt: number | null,
  ): Promise<void> {
    await redis.hset(quizKeys.state(sessionId), {
      status,
      questionIndex: String(questionIndex),
      phaseEndsAt: phaseEndsAt != null ? String(phaseEndsAt) : "",
    });
  },

  async writeQuestions(sessionId: string, questions: QuizQuestion[]): Promise<void> {
    await redis.set(quizKeys.questions(sessionId), JSON.stringify(questions));
  },

  async readQuestions(sessionId: string): Promise<QuizQuestion[]> {
    const raw = (await redis.get(quizKeys.questions(sessionId))) as string | null;
    if (!raw) return [];
    try {
      return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as QuizQuestion[];
    } catch {
      return [];
    }
  },

  async addPlayer(sessionId: string, userId: string): Promise<void> {
    const key = quizKeys.players(sessionId);
    const existing = await redis.hget(key, userId);
    if (existing) return; // idempotent join (e.g. reconnect)
    await redis.hset(key, {
      [userId]: JSON.stringify({
        userId,
        score: 0,
        streak: 0,
        ready: false,
        connected: true,
        lastAnsweredIndex: null,
      }),
    });
  },

  async setReady(sessionId: string, userId: string, ready: boolean): Promise<void> {
    const key = quizKeys.players(sessionId);
    const raw = await redis.hget(key, userId);
    if (!raw) return;
    const player = JSON.parse(raw as string);
    player.ready = ready;
    await redis.hset(key, { [userId]: JSON.stringify(player) });
  },

  async setConnected(sessionId: string, userId: string, connected: boolean): Promise<void> {
    const key = quizKeys.players(sessionId);
    const raw = await redis.hget(key, userId);
    if (!raw) return;
    const player = JSON.parse(raw as string);
    player.connected = connected;
    await redis.hset(key, { [userId]: JSON.stringify(player) });
  },

  async listPlayers(sessionId: string): Promise<
    { userId: string; score: number; streak: number; ready: boolean; connected: boolean; lastAnsweredIndex: number | null }[]
  > {
    const raw = await redis.hgetall(quizKeys.players(sessionId));
    if (!raw) return [];
    return Object.values(raw).map((v) => JSON.parse(v as string));
  },

  /** Server-authoritative answer submission. Rejects duplicate answers. */
  async submitAnswer(
    sessionId: string,
    questionIndex: number,
    userId: string,
    points: number,
    isCorrect: boolean,
  ): Promise<{ accepted: true; score: number; streak: number } | { accepted: false; reason: string }> {
    try {
      const result = (await redis.eval(SUBMIT_ANSWER_SCRIPT, {
        keys: [quizKeys.answered(sessionId, questionIndex), quizKeys.players(sessionId)],
        arguments: [userId, String(points), isCorrect ? "1" : "0", String(questionIndex)],
      })) as unknown[];
      return { accepted: true, score: toNumber(result?.[0]), streak: toNumber(result?.[1]) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("QUIZ_ALREADY_ANSWERED")) {
        return { accepted: false, reason: "QUIZ_ALREADY_ANSWERED" };
      }
      return { accepted: false, reason: "QUIZ_NOT_A_PLAYER" };
    }
  },

  /** Atomic top-up (streak bonus) applied after submitAnswer's base score. */
  async addScoreBonus(sessionId: string, userId: string, bonus: number): Promise<number> {
    const result = await redis.eval(ADD_BONUS_SCRIPT, {
      keys: [quizKeys.players(sessionId)],
      arguments: [userId, String(bonus)],
    });
    return toNumber(result);
  },

  async markActive(sessionId: string): Promise<void> {
    await redis.sadd(quizKeys.activeSet(), sessionId);
  },

  async markInactive(sessionId: string): Promise<void> {
    await redis.srem(quizKeys.activeSet(), sessionId);
  },

  async listActive(): Promise<string[]> {
    return (await redis.smembers(quizKeys.activeSet())) as string[];
  },

  async acquireLock(sessionId: string, token: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.eval(LOCK_SCRIPT, {
      keys: [quizKeys.lock(sessionId)],
      arguments: [token, String(ttlSeconds)],
    });
    return Number(result) === 1;
  },

  async releaseLock(sessionId: string, token: string): Promise<void> {
    await redis.eval(UNLOCK_SCRIPT, { keys: [quizKeys.lock(sessionId)], arguments: [token] });
  },

  /** Short retention after finish; Postgres (game_results) is the source of truth after this. */
  async expireState(sessionId: string, questionCount: number): Promise<void> {
    await redis.expire(quizKeys.state(sessionId), QUIZ_FINISHED_RETENTION_SECONDS);
    await redis.expire(quizKeys.players(sessionId), QUIZ_FINISHED_RETENTION_SECONDS);
    await redis.expire(quizKeys.questions(sessionId), QUIZ_FINISHED_RETENTION_SECONDS);
    for (let i = 0; i < questionCount; i++) {
      await redis.expire(quizKeys.answered(sessionId, i), QUIZ_FINISHED_RETENTION_SECONDS);
    }
  },
};
