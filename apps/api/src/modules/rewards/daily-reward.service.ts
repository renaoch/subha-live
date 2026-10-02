// Daily reward service (Core API). The server resolves the reward day (UTC),
// computes the streak/position, and calls fin_claim_daily_reward() which does
// the atomic claim + coin credit + ledger write. XP is applied after commit via
// the existing levels.addXp() (progression, not money). The client never sends
// a reward amount or day index.

import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { addXp } from "../levels/levels.service";
import {
  computeDailyRewardState,
  utcDayString,
} from "./daily-reward.logic";
import { dailyRewardRepository as repo } from "./daily-reward.repository";
import type {
  DailyRewardClaim,
  DailyRewardClaimResult,
  DailyRewardDefinition,
  DailyRewardOverview,
} from "./daily-reward.types";

const REWARD_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  USER_NOT_FOUND: { status: 404, code: "USER_NOT_FOUND", message: "User not found" },
  INVALID_REWARD_DAY: { status: 400, code: "INVALID_REWARD_DAY", message: "Invalid reward day" },
};

function throwMappedError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = Object.keys(REWARD_ERROR_MAP).find((c) => message.includes(c));
  if (code) {
    const mapped = REWARD_ERROR_MAP[code];
    throw new AppError(mapped.status, mapped.message, { code: mapped.code });
  }
  console.error("[daily-reward] unmapped claim error:", message);
  throw new AppError(500, fallback, { code: "REWARD_CLAIM_FAILED" });
}

function definitionFor(schedule: DailyRewardDefinition[], dayIndex: number): DailyRewardDefinition {
  const def = schedule[dayIndex - 1];
  if (!def) {
    throw new AppError(404, "No reward is configured for today", { code: "REWARD_NOT_CONFIGURED" });
  }
  return def;
}

export const dailyRewardService = {
  async getOverview(userId: string): Promise<DailyRewardOverview> {
    const schedule = await repo.getSchedule();
    const cycleLength = Math.max(1, schedule.length);
    const streak = await repo.getStreak(userId);
    const today = utcDayString(new Date());

    const state = computeDailyRewardState(streak.lastClaimDate, streak.currentStreak, today, cycleLength);

    const claimedDays: number[] = [];
    for (let d = 1; d < state.dayIndex; d += 1) claimedDays.push(d);
    if (state.alreadyClaimed) claimedDays.push(state.dayIndex);

    const coins = await repo.getCoins(userId);

    return {
      cycleLength,
      schedule,
      today,
      claimedDays,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      todayDayIndex: state.dayIndex,
      alreadyClaimedToday: state.alreadyClaimed,
      nextClaimAt: state.alreadyClaimed
        ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).toISOString()
        : today,
      coins,
    };
  },

  async claim(userId: string): Promise<DailyRewardClaimResult> {
    const schedule = await repo.getSchedule();
    const cycleLength = Math.max(1, schedule.length);
    const streak = await repo.getStreak(userId);
    const today = utcDayString(new Date());

    const state = computeDailyRewardState(streak.lastClaimDate, streak.currentStreak, today, cycleLength);

    if (state.alreadyClaimed) {
      const def = definitionFor(schedule, state.dayIndex);
      return {
        alreadyProcessed: true,
        claimId: "",
        dayIndex: state.dayIndex,
        rewardCoins: def.rewardCoins,
        rewardXp: def.rewardXp,
        newCoins: await repo.getCoins(userId),
        newStreak: streak.currentStreak,
      };
    }

    const def = definitionFor(schedule, state.dayIndex);

    try {
      const result = await repo.claim({
        userId,
        rewardDate: today,
        dayIndex: state.dayIndex,
        rewardCoins: def.rewardCoins,
        rewardXp: def.rewardXp,
      });

      // XP is progression, not money — applied after the atomic claim commits,
      // guarded by alreadyProcessed so a retry never double-grants XP.
      if (!result.alreadyProcessed && def.rewardXp > 0) {
        await addXp(userId, def.rewardXp).catch((error) => {
          console.error("[daily-reward] XP grant failed (coins already credited):", error);
        });
      }

      await logAudit({
        actorId: userId,
        action: "DAILY_REWARD_CLAIMED",
        entityType: "daily_reward_claims",
        entityId: result.claimId,
        newValue: {
          dayIndex: state.dayIndex,
          rewardCoins: def.rewardCoins,
          rewardXp: def.rewardXp,
          newStreak: result.newStreak,
          alreadyProcessed: result.alreadyProcessed,
        },
      });

      return {
        alreadyProcessed: result.alreadyProcessed,
        claimId: result.claimId,
        dayIndex: state.dayIndex,
        rewardCoins: def.rewardCoins,
        rewardXp: def.rewardXp,
        newCoins: result.newCoins,
        newStreak: result.newStreak,
      };
    } catch (error) {
      throwMappedError(error, "Failed to claim daily reward");
    }
  },

  async getHistory(userId: string, limit: number): Promise<DailyRewardClaim[]> {
    return repo.listRecentClaims(userId, limit);
  },
};
