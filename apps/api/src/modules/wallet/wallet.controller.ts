import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../errors/app-error";
import {
  getWallet,
  purchaseCoins,
  requestWithdrawal,
  getTransactionHistory,
  COIN_PACKAGES,
  getCryptoRechargeQuote,
  verifyCryptoRecharge,
} from "./wallet.service";
import {
  purchasePackageSchema,
  withdrawalRequestSchema,
  cryptoVerifySchema,
} from "./wallet.schema";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

export async function getWalletController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const wallet = await getWallet(user.id);
    const history = await getTransactionHistory(user.id);
    res.status(200).json({
      status: "ok",
      data: { ...wallet, history, packages: COIN_PACKAGES },
    });
  } catch (error) {
    next(error);
  }
}

export async function purchaseCoinsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const parsed = purchasePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid payload", { details: parsed.error.flatten() });
    }
    const result = await purchaseCoins(user.id, parsed.data.packageId);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
}

export async function cryptoQuoteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    requireUser(req);
    const packageId = String(req.params.packageId);
    const quote = await getCryptoRechargeQuote(packageId);
    res.status(200).json({ status: "ok", data: quote });
  } catch (error) {
    next(error);
  }
}

export async function cryptoVerifyController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const parsed = cryptoVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid payload", { details: parsed.error.flatten() });
    }
    const result = await verifyCryptoRecharge(user.id, parsed.data);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
}

export async function requestWithdrawalController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireUser(req);
    const parsed = withdrawalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid payload", { details: parsed.error.flatten() });
    }
    const result = await requestWithdrawal(user.id, parsed.data);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
}