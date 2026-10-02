import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { referralService } from "./referral.service";
import { applyReferralSchema, referralHistoryQuerySchema } from "./referral.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getReferralOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const overview = await referralService.getOverview(user.id);
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}

export async function applyReferral(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = applyReferralSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid referral code", { code: "INVALID_REFERRAL_CODE" });
    }
    const result = await referralService.apply(user.id, parsed.data.code);
    res.status(result.alreadyProcessed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getReferralHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = referralHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Invalid query", { code: "INVALID_REFERRAL_QUERY" });
    }
    const history = await referralService.getHistory(user.id, query.data.limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}
