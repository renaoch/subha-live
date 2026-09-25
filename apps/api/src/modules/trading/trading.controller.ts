import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { tradingService } from "./trading.service";
import {
  creditSchema,
  payHostSchema,
  transactionsQuerySchema,
  verifyHostSchema,
} from "./trading.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getTradingOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const overview = await tradingService.getOverview(user.id);
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}

export async function getTradingTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = transactionsQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Invalid query", { code: "INVALID_TRADING_QUERY" });
    }
    const entries = await tradingService.listTransactions(user.id, query.data.limit, query.data.offset);
    res.status(200).json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
}

export async function verifyHost(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = verifyHostSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid host ID", { code: "INVALID_HOST_ID" });
    }
    const host = await tradingService.verifyHost(user.id, parsed.data.hostId);
    res.status(200).json({ success: true, data: host });
  } catch (error) {
    next(error);
  }
}

export async function payHost(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = payHostSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid payment payload", {
        code: "INVALID_PAYMENT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await tradingService.payHost(user.id, parsed.data);
    res.status(result.alreadyProcessed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function creditTrading(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = creditSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid credit payload", {
        code: "INVALID_CREDIT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const newBalance = await tradingService.credit(user.id, parsed.data);
    res.status(200).json({ success: true, data: { newBalance } });
  } catch (error) {
    next(error);
  }
}
