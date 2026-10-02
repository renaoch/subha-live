import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { dailyRewardService } from "./daily-reward.service";
import { dailyRewardHistoryQuerySchema } from "./daily-reward.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getDailyRewardOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const overview = await dailyRewardService.getOverview(user.id);
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}

export async function claimDailyReward(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await dailyRewardService.claim(user.id);
    res.status(result.alreadyProcessed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDailyRewardHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = dailyRewardHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Invalid history query", { code: "INVALID_REWARD_QUERY" });
    }
    const history = await dailyRewardService.getHistory(user.id, query.data.limit);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}
