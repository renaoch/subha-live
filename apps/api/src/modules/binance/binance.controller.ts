import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../errors/app-error";
import { assertIsPlatformAdmin } from "../tasks/tasks.service";
import {
  getSymbolPrice,
  getSymbolPrices,
  getAccountBalances,
  placeMarketOrder,
  getOrderStatus,
  getRecentOrders,
  getBinanceStatus,
} from "./binance.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", {
      code: "AUTHENTICATION_REQUIRED",
    });
  }
  return req.user;
}

// GET /api/v1/binance/status — any logged-in user, no secrets exposed.
export async function statusController(req: Request, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    res.json(getBinanceStatus());
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/binance/price/:symbol — any logged-in user.
export async function priceController(req: Request, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const symbol = String(req.params.symbol).toUpperCase();
    const data = await getSymbolPrice(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/binance/prices?symbols=BTCUSDT,ETHUSDT
export async function pricesController(req: Request, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const symbols = String(req.query.symbols || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) throw new AppError(400, "symbols query param required");
    const data = await getSymbolPrices(symbols);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ─── Admin-only: platform treasury account ─────────────────────
// These touch the real, signed Binance account. Every request here is
// authenticated AND authorized as platform admin before anything is
// signed or sent.

export async function balancesController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);
    const data = await getAccountBalances();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function placeOrderController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    const { symbol, side, quoteOrderQty } = req.body ?? {};
    if (!symbol || !side || !quoteOrderQty) {
      throw new AppError(400, "symbol, side, quoteOrderQty are required");
    }
    if (side !== "BUY" && side !== "SELL") {
      throw new AppError(400, "side must be BUY or SELL");
    }

    const data = await placeMarketOrder({
      symbol: String(symbol).toUpperCase(),
      side,
      quoteOrderQty: Number(quoteOrderQty),
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function orderStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);
    const symbol = String(req.params.symbol);
    const orderId = String(req.params.orderId);
    const data = await getOrderStatus(symbol.toUpperCase(), Number(orderId));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function recentOrdersController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) throw new AppError(400, "symbol query param required");
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const data = await getRecentOrders(symbol, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}