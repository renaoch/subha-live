// Subha Lucky service (Core API). Orchestrates a spin:
//
//   authenticate (middleware) -> authorize room -> validate bet -> generate the
//   authoritative result (crypto.randomInt) -> settle atomically via
//   fin_lucky_spin() -> return the authoritative result + new balance.
//
// The client never determines symbols/multiplier/payout — it only sends a room,
// a bet and an idempotency key. The result is computed here, server-side, using
// a cryptographically-secure RNG, and the economic settlement is re-verified
// inside fin_lucky_spin() under a row lock.

import { randomInt } from "crypto";
import { AppError } from "../../errors/app-error";
import { roomService } from "../rooms/room.service";
import { getPublicLuckyConfig, isBetAllowed, LUCKY_CONFIG_VERSION } from "./lucky.config";
import { spinOutcome } from "./lucky.logic";
import { luckyRepository } from "./lucky.repository";
import type {
  LuckyPublicConfig,
  LuckyRecentResult,
  LuckySpinResult,
  LuckyStateResponse,
} from "./lucky.types";

/** Postgres RAISE EXCEPTION codes -> HTTP status + machine-readable code. */
const LUCKY_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  USER_NOT_FOUND: { status: 404, code: "USER_NOT_FOUND", message: "User not found" },
  INSUFFICIENT_BALANCE: { status: 400, code: "INSUFFICIENT_BALANCE", message: "Insufficient coin balance" },
  INVALID_BET: { status: 400, code: "INVALID_BET", message: "Invalid bet amount" },
  INVALID_RESULT: { status: 500, code: "INVALID_RESULT", message: "Invalid game result" },
};

function extractLuckyErrorCode(message: string | undefined | null): string | null {
  if (!message) return null;
  const match = Object.keys(LUCKY_ERROR_MAP).find((code) => message.includes(code));
  return match ?? null;
}

function throwMappedError(error: unknown, fallbackMessage: string): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = extractLuckyErrorCode(message);
  if (code) {
    const mapped = LUCKY_ERROR_MAP[code];
    throw new AppError(mapped.status, mapped.message, { code: mapped.code });
  }
  throw new AppError(500, fallbackMessage, {
    code: "LUCKY_SPIN_FAILED",
    details: message,
  });
}

/** Crypto-secure RNG bound — the ONLY source of randomness for outcomes. */
const secureRng = (bound: number): number => randomInt(bound);

export const luckyService = {
  getConfig(): LuckyPublicConfig {
    return getPublicLuckyConfig();
  },

  /** One authoritative spin. */
  async spin(
    userId: string,
    input: { roomId: string; bet: number; clientRequestId: string },
  ): Promise<LuckySpinResult> {
    // Room access: never trust a room id from the browser.
    const auth = await roomService.authorize(input.roomId, userId);
    if (!auth.canAccess) {
      throw new AppError(403, "You cannot play in this room", { code: "ROOM_ACCESS_DENIED" });
    }

    if (!isBetAllowed(input.bet)) {
      throw new AppError(400, "Invalid bet amount", { code: "INVALID_BET" });
    }

    // Authoritative outcome — computed here, never by the client.
    const result = spinOutcome(input.bet, secureRng);

    try {
      return await luckyRepository.spin({
        userId,
        roomId: input.roomId,
        bet: input.bet,
        clientRequestId: input.clientRequestId,
        result,
        configVersion: LUCKY_CONFIG_VERSION,
      });
    } catch (error) {
      throwMappedError(error, "Failed to settle spin");
    }
  },

  /** Recent results (actual persisted rounds), newest first. */
  async recentResults(userId: string, limit: number): Promise<LuckyRecentResult[]> {
    return luckyRepository.listRecent(userId, limit);
  },

  /** Authoritative "today's winnings" from persisted rounds. */
  async todayWinnings(userId: string): Promise<number> {
    return luckyRepository.todayWinnings(userId);
  },

  /** Combined state for the game shell (config + balance + winnings + history). */
  async getState(userId: string, limit: number): Promise<LuckyStateResponse> {
    const [balance, todayWinnings, recentResults] = await Promise.all([
      luckyRepository.getBalance(userId),
      luckyRepository.todayWinnings(userId),
      luckyRepository.listRecent(userId, limit),
    ]);
    return {
      config: getPublicLuckyConfig(),
      balance,
      todayWinnings,
      recentResults,
    };
  },
};
