import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { luckyRingService } from "./lucky-ring.service";
import { luckyRingBetSchema, luckyRingRoomQuerySchema } from "./lucky-ring.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getLuckyRingConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, data: luckyRingService.getConfig() });
  } catch (error) {
    next(error);
  }
}

export async function getLuckyRingState(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = luckyRingRoomQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "roomId is required", { code: "INVALID_LUCKY_RING_QUERY" });
    }
    const state = await luckyRingService.getState(user.id, query.data.roomId);
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function placeLuckyRingBet(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = luckyRingBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid bet payload", {
        code: "INVALID_LUCKY_RING_BET",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await luckyRingService.placeBet(user.id, parsed.data.roomId, {
      cellIndex: parsed.data.cellIndex,
      amount: parsed.data.amount,
      clientRequestId: parsed.data.clientRequestId,
    });
    res.status(result.alreadyProcessed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}