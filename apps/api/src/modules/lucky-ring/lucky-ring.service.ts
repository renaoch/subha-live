// Lucky Ring game orchestration (Core API). Server-authoritative: the client
// only ever sends "I bet N on cell C" — every phase transition, the winning
// cell, and every payout are computed here. Mirrors modules/quiz/quiz.service
// .ts's shape (Redis for the live round, Postgres for durable economy).

import { randomInt, randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { luckyRingRedis } from "./lucky-ring.redis";
import { luckyRingRepository } from "./lucky-ring.repository";
import { luckyRingEvents } from "./lucky-ring.events";
import { drawWinningCell } from "./lucky-ring.logic";
import {
  LUCKY_RING_BETS,
  LUCKY_RING_BETTING_MS,
  LUCKY_RING_CELLS,
  LUCKY_RING_CONFIG_VERSION,
  LUCKY_RING_MAX_PAYOUT,
  LUCKY_RING_SETTLED_DISPLAY_MS,
  LUCKY_RING_SPIN_MS,
  isLuckyRingBetAllowed,
  luckyRingCellByIndex,
} from "./lucky-ring.config";
import type { LuckyRingPublicConfig, LuckyRingRedisState, LuckyRingStateResponse } from "./lucky-ring.types";

const secureRng = (bound: number): number => randomInt(bound);

interface RoomRef {
  id: string;
  status: string;
}

async function getRoomOrThrow(roomId: string): Promise<RoomRef> {
  const { data, error } = await supabase.from("rooms").select("id, status").eq("id", roomId).maybeSingle();
  if (error || !data) {
    throw new AppError(404, "Room not found", { code: "ROOM_NOT_FOUND" });
  }
  return data as RoomRef;
}

function toPublicConfig(): LuckyRingPublicConfig {
  return {
    configVersion: LUCKY_RING_CONFIG_VERSION,
    gameType: "lucky_ring",
    bets: [...LUCKY_RING_BETS],
    cells: LUCKY_RING_CELLS.map((c) => ({ index: c.index, symbol: c.symbol, multiplier: c.multiplier })),
    bettingMs: LUCKY_RING_BETTING_MS,
    spinMs: LUCKY_RING_SPIN_MS,
    maxPayout: LUCKY_RING_MAX_PAYOUT,
  };
}

export const luckyRingService = {
  getConfig(): LuckyRingPublicConfig {
    return toPublicConfig();
  },

  /**
   * Returns the room's current round, lazily starting one if none is active.
   * Guarded by the same per-room Redis lock the finalizer uses, so two
   * viewers opening a fresh room at the same instant can't both create
   * round #1 (which would collide on the (room_id, round_number) unique
   * constraint).
   */
  async ensureRound(roomId: string): Promise<LuckyRingRedisState> {
    const existing = await luckyRingRedis.readState(roomId);
    if (existing) return existing;

    await getRoomOrThrow(roomId);

    const token = randomUUID();
    const locked = await luckyRingRedis.acquireLock(roomId, token, 10);
    if (!locked) {
      // Someone else is creating it right now — brief wait and re-read.
      await new Promise((r) => setTimeout(r, 250));
      const afterWait = await luckyRingRedis.readState(roomId);
      if (afterWait) return afterWait;
      throw new AppError(503, "Lucky Ring is starting up — try again", {
        code: "LUCKY_RING_STARTING",
      });
    }

    try {
      // Re-check after acquiring the lock in case it was created while we waited for it.
      const afterLock = await luckyRingRedis.readState(roomId);
      if (afterLock) return afterLock;

      const { id } = await luckyRingRepository.createRound({
        roomId,
        roundNumber: 1,
        configVersion: LUCKY_RING_CONFIG_VERSION,
      });
      const state: LuckyRingRedisState = {
        roundId: id,
        roomId,
        roundNumber: 1,
        status: "BETTING",
        phaseEndsAt: Date.now() + LUCKY_RING_BETTING_MS,
        winningCell: null,
        configVersion: LUCKY_RING_CONFIG_VERSION,
        version: 0,
      };
      await luckyRingRedis.writeState(roomId, state);
      await luckyRingRedis.markActive(roomId);
      await luckyRingEvents.publishRoom(roomId, {
        type: "LUCKY_RING_BETTING_OPEN",
        roundId: state.roundId,
        roundNumber: state.roundNumber,
        phaseEndsAt: state.phaseEndsAt,
      });
      return state;
    } finally {
      await luckyRingRedis.releaseLock(roomId, token);
    }
  },

  async placeBet(
    userId: string,
    roomId: string,
    input: { cellIndex: number; amount: number; clientRequestId: string },
  ): Promise<{ newCoins: number; totalOnCell: number; cellIndex: number; alreadyProcessed: boolean }> {
    if (!isLuckyRingBetAllowed(input.amount)) {
      throw new AppError(400, "Invalid bet amount", { code: "LUCKY_RING_INVALID_BET" });
    }
    if (input.cellIndex < 0 || input.cellIndex > 9) {
      throw new AppError(400, "Invalid cell", { code: "LUCKY_RING_INVALID_CELL" });
    }

    const state = await this.ensureRound(roomId);
    if (state.status !== "BETTING" || (state.phaseEndsAt != null && Date.now() > state.phaseEndsAt)) {
      throw new AppError(409, "Betting is closed for this round", { code: "LUCKY_RING_BETTING_CLOSED" });
    }

    const result = await luckyRingRepository.placeBet({
      userId,
      roomId,
      roundId: state.roundId,
      cellIndex: input.cellIndex,
      amount: input.amount,
      clientRequestId: input.clientRequestId,
      configVersion: state.configVersion,
    });

    if (!result.alreadyProcessed) {
      await luckyRingEvents.publishRoom(roomId, {
        type: "LUCKY_RING_BET_PLACED",
        roundId: state.roundId,
        userId,
        cellIndex: input.cellIndex,
        amount: input.amount,
      });
    }

    return { ...result, cellIndex: input.cellIndex };
  },

  async getState(userId: string, roomId: string): Promise<LuckyRingStateResponse> {
    const state = await this.ensureRound(roomId);
    const [balance, myBets, todayWinnings, recentResults] = await Promise.all([
      luckyRingRepository.getBalance(userId),
      luckyRingRepository.getMyBets(state.roundId, userId),
      luckyRingRepository.todayWinnings(roomId, userId),
      luckyRingRepository.listRecentSettled(roomId, 8),
    ]);

    return {
      config: toPublicConfig(),
      roundId: state.roundId,
      roundNumber: state.roundNumber,
      status: state.status,
      phaseEndsAt: state.phaseEndsAt,
      // Withheld from clients until betting has actually closed.
      winningCell: state.status === "BETTING" ? null : state.winningCell,
      balance,
      todayWinnings,
      myBets,
      recentResults,
    };
  },

  // ---------------------------------------------------------------------
  // Internal: called only by lucky-ring.finalizer.ts's timer tick, never a
  // route. Advances BETTING -> SPINNING -> SETTLED (result held on screen)
  // -> next BETTING, looping forever while the room stays active.
  // ---------------------------------------------------------------------
  async advancePhase(roomId: string): Promise<void> {
    const state = await luckyRingRedis.readState(roomId);
    if (!state) return;

    if (state.status === "BETTING") {
      const winningCell = drawWinningCell(secureRng);
      const phaseEndsAt = Date.now() + LUCKY_RING_SPIN_MS;
      await luckyRingRedis.setPhase(roomId, "SPINNING", phaseEndsAt, winningCell);
      await luckyRingEvents.publishRoom(roomId, {
        type: "LUCKY_RING_SPINNING",
        roundId: state.roundId,
        winningCell,
        phaseEndsAt,
      });
      return;
    }

    if (state.status === "SPINNING") {
      if (state.winningCell == null) return; // defensive; should never happen
      const cell = luckyRingCellByIndex(state.winningCell);
      await luckyRingRepository.settleRound(state.roundId, state.winningCell, cell.multiplier);

      // Hold the settled result on screen for LUCKY_RING_SETTLED_DISPLAY_MS
      // before opening the next round — otherwise a polling client could
      // never observe the win/lose reveal at all.
      const phaseEndsAt = Date.now() + LUCKY_RING_SETTLED_DISPLAY_MS;
      await luckyRingRedis.setPhase(roomId, "SETTLED", phaseEndsAt, state.winningCell);
      await luckyRingEvents.publishRoom(roomId, {
        type: "LUCKY_RING_SETTLED",
        roundId: state.roundId,
        roundNumber: state.roundNumber,
        winningCell: state.winningCell,
      });
      return;
    }

    if (state.status === "SETTLED") {
      const nextRoundNumber = state.roundNumber + 1;
      const { id: nextRoundId } = await luckyRingRepository.createRound({
        roomId,
        roundNumber: nextRoundNumber,
        configVersion: state.configVersion,
      });
      const phaseEndsAt = Date.now() + LUCKY_RING_BETTING_MS;
      await luckyRingRedis.writeState(roomId, {
        roundId: nextRoundId,
        roomId,
        roundNumber: nextRoundNumber,
        status: "BETTING",
        phaseEndsAt,
        winningCell: null,
        configVersion: state.configVersion,
        version: state.version + 1,
      });
      await luckyRingEvents.publishRoom(roomId, {
        type: "LUCKY_RING_BETTING_OPEN",
        roundId: nextRoundId,
        roundNumber: nextRoundNumber,
        phaseEndsAt,
      });
    }
  },
};