// Referral service (Core API). Derives the user from auth, generates/reads
// their code, validates an applied code server-side, and settles the reward via
// fin_apply_referral() (atomic + idempotent). The client never supplies a
// reward amount.

import { randomBytes } from "crypto";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { codeFromBytes, isValidCodeShape, REFERRAL_REWARD_COINS } from "./referral.logic";
import { referralRepository as repo } from "./referral.repository";
import type { ApplyReferralResult, ReferralEntry, ReferralOverview } from "./referral.types";

const REFERRAL_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  SELF_REFERRAL: { status: 400, code: "SELF_REFERRAL", message: "You cannot refer yourself" },
  REFERRER_NOT_FOUND: { status: 404, code: "REFERRER_NOT_FOUND", message: "Referral code is invalid" },
};

function throwMappedError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = Object.keys(REFERRAL_ERROR_MAP).find((c) => message.includes(c));
  if (code) {
    const mapped = REFERRAL_ERROR_MAP[code];
    throw new AppError(mapped.status, mapped.message, { code: mapped.code });
  }
  console.error("[referral] unmapped error:", message);
  throw new AppError(500, fallback, { code: "REFERRAL_FAILED" });
}

function generateCode(): string {
  return codeFromBytes(randomBytes(16));
}

/** Generate + persist a code, retrying on the rare (unique) code collision. */
async function ensureCode(userId: string): Promise<string> {
  const existing = await repo.getExistingCode(userId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    try {
      return await repo.createCode(userId, code);
    } catch (error) {
      // 23505 = unique violation on the code — regenerate and retry.
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }

  throw new AppError(500, "Failed to generate referral code", { code: "REFERRAL_CODE_FAILED" });
}

export const referralService = {
  async getOverview(userId: string): Promise<ReferralOverview> {
    const code = await ensureCode(userId);
    const [{ totalReferrals, totalRewardCoins }, alreadyApplied] = await Promise.all([
      repo.getOverview(userId),
      repo.hasApplied(userId),
    ]);
    return {
      code,
      totalReferrals,
      totalRewardCoins,
      rewardPerReferral: REFERRAL_REWARD_COINS,
      alreadyApplied,
    };
  },

  async getHistory(userId: string, limit: number): Promise<ReferralEntry[]> {
    return repo.listRecent(userId, limit);
  },

  async apply(userId: string, rawCode: string): Promise<ApplyReferralResult> {
    const code = rawCode.trim().toUpperCase();
    if (!isValidCodeShape(code)) {
      throw new AppError(400, "That referral code is invalid", { code: "INVALID_REFERRAL_CODE" });
    }

    const referrerId = await repo.findReferrerByCode(code);
    if (!referrerId) {
      throw new AppError(404, "Referral code is invalid", { code: "REFERRER_NOT_FOUND" });
    }
    if (referrerId === userId) {
      throw new AppError(400, "You cannot refer yourself", { code: "SELF_REFERRAL" });
    }

    try {
      const result = await repo.apply({ referredId: userId, referrerId, rewardCoins: REFERRAL_REWARD_COINS });

      if (!result.alreadyProcessed) {
        await logAudit({
          actorId: userId,
          action: "REFERRAL_APPLIED",
          entityType: "referrals",
          entityId: result.referralId,
          newValue: { referrerId, rewardCoins: REFERRAL_REWARD_COINS },
        });
      }

      return {
        alreadyProcessed: result.alreadyProcessed,
        referralId: result.referralId,
        rewardCoins: REFERRAL_REWARD_COINS,
        referrerId,
        referrerName: await repo.getProfileName(referrerId),
      };
    } catch (error) {
      throwMappedError(error, "Failed to apply referral code");
    }
  },
};
