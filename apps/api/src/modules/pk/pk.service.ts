// PK battle orchestration (Core API). Owns the durable record + Redis hot
// state + event publishing. All transitions re-validated server-side; the
// client is never authoritative.

import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { isScoreable } from "./pk.state";
import { winnerOf, winnerHostId } from "./pk.logic";
import { pkRedis } from "./pk.redis";
import { pkRepository } from "./pk.repository";
import { pkEvents } from "./pk.events";
import {
  PK_DEFAULT_DURATION_MS,
  type PkBattleRow,
  type PkRedisState,
  type PkSide,
  type PkWinner,
} from "./pk.types";

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

/** Resolve a host's current live room, or null if none. */
async function findLiveRoomForHost(hostId: string): Promise<RoomRef | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, host_id, status")
    .eq("host_id", hostId)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as RoomRef | null) ?? null;
}

function assertHost(battle: PkBattleRow, hostId: string): void {
  if (battle.host_a_id !== hostId && battle.host_b_id !== hostId) {
    throw new AppError(403, "You are not a participant in this PK", { code: "PK_FORBIDDEN" });
  }
}

export const pkService = {
  /** Host A (inviter) creates an invitation against host B (opponent). */
  async invite(roomId: string, opponentHostId: string, inviterHostId: string): Promise<PkBattleRow> {
    if (opponentHostId === inviterHostId) {
      throw new AppError(400, "You cannot invite yourself", { code: "PK_SELF_INVITE" });
    }

    const roomA = await getRoomOrThrow(roomId);
    if (roomA.host_id !== inviterHostId) {
      throw new AppError(403, "You must be the host of this room", { code: "PK_ROOM_OWNERSHIP" });
    }

    const roomB = await findLiveRoomForHost(opponentHostId);
    if (!roomB) {
      throw new AppError(409, "Opponent is not live", { code: "PK_OPPONENT_NOT_LIVE" });
    }

    const battle = await pkRepository.createBattle({
      roomAId: roomA.id,
      roomBId: roomB.id,
      hostAId: inviterHostId,
      hostBId: opponentHostId,
      invitedBy: inviterHostId,
    });

    await pkEvents.publishHost(opponentHostId, {
      type: "PK_INVITE",
      battleId: battle.id,
      fromHostId: inviterHostId,
    });

    return battle;
  },

  /** Host B accepts the invitation. */
  async accept(battleId: string, hostId: string): Promise<PkBattleRow> {
    const battle = await pkRepository.getBattleOrThrow(battleId);
    if (battle.host_b_id !== hostId) {
      throw new AppError(403, "Only the invited host can accept", { code: "PK_FORBIDDEN" });
    }
    const updated = await pkRepository.transitionStatus(battleId, "INVITED", "ACCEPTED");
    if (!updated) {
      throw new AppError(409, "Invitation is no longer pending", { code: "PK_INVALID_STATE" });
    }
    await pkEvents.publishHost(battle.host_a_id, {
      type: "PK_ACCEPT",
      battleId,
      fromHostId: hostId,
    });
    return updated;
  },

  /** Host B declines the invitation. */
  async decline(battleId: string, hostId: string): Promise<PkBattleRow> {
    const battle = await pkRepository.getBattleOrThrow(battleId);
    if (battle.host_b_id !== hostId) {
      throw new AppError(403, "Only the invited host can decline", { code: "PK_FORBIDDEN" });
    }
    const updated = await pkRepository.transitionStatus(battleId, "INVITED", "CANCELLED", {
      ended_at: new Date().toISOString(),
    });
    if (!updated) {
      throw new AppError(409, "Invitation is no longer pending", { code: "PK_INVALID_STATE" });
    }
    await pkEvents.publishBattle(battleId, { type: "PK_CANCEL", reason: "DECLINED" });
    await pkEvents.publishHost(battle.host_a_id, {
      type: "PK_DECLINE",
      battleId,
      fromHostId: hostId,
    });
    return updated;
  },

  /** Host A starts the battle (after B accepted). */
  async start(battleId: string, hostId: string, durationMs = PK_DEFAULT_DURATION_MS): Promise<PkBattleRow> {
    const battle = await pkRepository.getBattleOrThrow(battleId);
    if (battle.host_a_id !== hostId) {
      throw new AppError(403, "Only the inviter can start the battle", { code: "PK_FORBIDDEN" });
    }

    // Both hosts must still be live.
    const roomA = await getRoomOrThrow(battle.room_a_id);
    const roomB = await getRoomOrThrow(battle.room_b_id);
    if (roomA.status !== "live" || roomB.status !== "live") {
      throw new AppError(409, "Both hosts must be live to start", { code: "PK_HOST_NOT_LIVE" });
    }

    // Neither host may already be in another PK (atomic in Redis).
    const claimed = await pkRedis.claimHosts(battleId, battle.host_a_id, battle.host_b_id);
    if (!claimed) {
      throw new AppError(409, "A host is already in another battle", { code: "PK_HOST_BUSY" });
    }

    const started = await pkRepository.transitionStatus(battleId, "ACCEPTED", "STARTING");
    if (!started) {
      await pkRedis.releaseHosts(battleId, battle.host_a_id, battle.host_b_id);
      throw new AppError(409, "Battle cannot be started", { code: "PK_INVALID_STATE" });
    }

    const startedAt = Date.now();
    const endsAt = startedAt + durationMs;

    const state: PkRedisState = {
      battleId,
      status: "ACTIVE",
      hostA: battle.host_a_id,
      hostB: battle.host_b_id,
      roomA: battle.room_a_id,
      roomB: battle.room_b_id,
      scoreA: 0,
      scoreB: 0,
      startedAt,
      endsAt,
      version: 0,
    };
    await pkRedis.writeState(battleId, state);

    const active = await pkRepository.transitionStatus(battleId, "STARTING", "ACTIVE", {
      started_at: new Date(startedAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    });
    await pkRedis.markActive(battleId);
    await pkRepository.upsertParticipant(battleId, battle.host_a_id, "A");
    await pkRepository.upsertParticipant(battleId, battle.host_b_id, "B");

    await pkEvents.publishBattle(battleId, {
      type: "PK_START",
      startedAt,
      endsAt,
      durationMs,
    });

    return active ?? started;
  },

  /** Either host cancels the battle before it finishes. */
  async cancel(battleId: string, hostId: string): Promise<PkBattleRow> {
    const battle = await pkRepository.getBattleOrThrow(battleId);
    assertHost(battle, hostId);

    const updated = await pkRepository.transitionStatus(
      battleId,
      ["INVITED", "ACCEPTED", "STARTING", "ACTIVE"],
      "CANCELLED",
      { ended_at: new Date().toISOString() },
    );
    if (!updated) {
      throw new AppError(409, "Battle cannot be cancelled", { code: "PK_INVALID_STATE" });
    }

    await pkRedis.releaseHosts(battleId, battle.host_a_id, battle.host_b_id);
    await pkRedis.markInactive(battleId);
    await pkRedis.deleteState(battleId);
    await pkEvents.publishBattle(battleId, { type: "PK_CANCEL", reason: "HOST_CANCELLED" });
    return updated;
  },

  /**
   * Gift → score hook. Called ONLY after the underlying gift transaction has
   * been durably committed. Ties the score increment to the gift transaction id
   * for idempotency; never scores before the gift succeeded.
   */
  async recordGiftScore(
    recipientHostId: string,
    giftValue: number,
    giftTxId: string,
  ): Promise<{ battleId: string; side: PkSide; scoreA: number; scoreB: number; version: number } | null> {
    // Resolve the recipient's active battle via the host index.
    const battleId = await pkRedis.getHostBattle(recipientHostId);
    if (!battleId) return null;

    const state = await pkRedis.readState(battleId);
    if (!state || !isScoreable(state.status)) return null;

    const side: PkSide = state.hostA === recipientHostId ? "A" : "B";
    const result = await pkRedis.addScore(battleId, side, giftTxId, giftValue);
    if (!result.added) return null;

    await pkEvents.publishBattle(battleId, {
      type: "PK_SCORE_UPDATE",
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      version: result.version,
    });
    await pkEvents.publishBattle(battleId, {
      type: "PK_GIFT_EVENT",
    });

    return { battleId, side, scoreA: result.scoreA, scoreB: result.scoreB, version: result.version };
  },

  /** Finalize an expired battle. Idempotent + guarded by a Redis lock. */
  async finalize(battleId: string): Promise<{ winner: PkWinner; scoreA: number; scoreB: number } | null> {
    const token = randomUUID();
    const locked = await pkRedis.acquireFinalizeLock(battleId, token, 30);
    if (!locked) return null;

    try {
      const state = await pkRedis.readState(battleId);
      if (!state || state.status !== "ACTIVE") return null;

      await pkRedis.setStatus(battleId, "FINALIZING");

      const scoreA = state.scoreA;
      const scoreB = state.scoreB;
      const winner = winnerOf(scoreA, scoreB);

      const battle = await pkRepository.getBattleOrThrow(battleId);
      await pkRepository.finalize(battleId, {
        scoreA,
        scoreB,
        winnerSide: winner,
        winnerHostId: winnerHostId(battle.host_a_id, battle.host_b_id, winner),
        endedAt: new Date().toISOString(),
      });

      await pkRedis.setStatus(battleId, "FINISHED");
      await pkRedis.expireState(battleId);
      await pkRedis.markInactive(battleId);
      await pkRedis.releaseHosts(battleId, battle.host_a_id, battle.host_b_id);

      await pkEvents.publishBattle(battleId, {
        type: "PK_RESULT",
        winner,
        scoreA,
        scoreB,
        version: state.version,
      });

      return { winner, scoreA, scoreB };
    } finally {
      await pkRedis.releaseFinalizeLock(battleId, token);
    }
  },

  /** Read the hot state for a battle (viewer sync). */
  async getState(battleId: string): Promise<PkRedisState | null> {
    return pkRedis.readState(battleId);
  },

  /** Discover the active battle for a room (via its host's busy index). */
  async getForRoom(roomId: string): Promise<PkRedisState | null> {
    const room = await getRoomOrThrow(roomId);
    const battleId = await pkRedis.getHostBattle(room.host_id);
    if (!battleId) return null;
    return pkRedis.readState(battleId);
  },
};
