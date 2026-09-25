import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { luckyService } from "./lucky.service";
import { luckySpinSchema, luckyHistoryQuerySchema } from "./lucky.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getLuckyConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, data: luckyService.getConfig() });
  } catch (error) {
    next(error);
  }
}

export async function getLuckyState(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = luckyHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Invalid history query", { code: "INVALID_LUCKY_QUERY" });
    }
    const state = await luckyService.getState(user.id, query.data.limit);
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function spinLucky(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = luckySpinSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid spin payload", {
        code: "INVALID_LUCKY_SPIN",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await luckyService.spin(user.id, parsed.data);
    res.status(result.alreadyProcessed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getLuckyHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = luckyHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Invalid history query", { code: "INVALID_LUCKY_QUERY" });
    }
    const results = await luckyService.recentResults(user.id, query.data.limit);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
}
