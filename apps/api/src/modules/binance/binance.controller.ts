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
  getDepositAddress,
  verifyAndCreditDeposit,
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

// ─── User-facing: automated crypto recharge ─────────────────────
// No admin ever touches these two. Deposit address comes straight from
// the platform's own Binance account; crediting only ever happens after
// verifyAndCreditDeposit() independently confirms the deposit against
// Binance's own record for the txId (see binance.service.ts for the full
// trust model).

// GET /api/v1/binance/recharge/deposit-address?coin=USDT&network=TRC20
export async function depositAddressController(req: Request, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const coin = String(req.query.coin || "USDT").toUpperCase();
    const network = req.query.network ? String(req.query.network) : undefined;
    const data = await getDepositAddress(coin, network);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/binance/recharge/verify { coin, txId }
// Automatically credits coins the moment Binance's own deposit history
// confirms the transaction — nobody approves this by hand.
export async function verifyRechargeController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const { coin, txId } = req.body ?? {};
    if (!coin || !txId) {
      throw new AppError(400, "coin and txId are required");
    }
    const result = await verifyAndCreditDeposit({
      userId: user.id,
      coin: String(coin),
      txId: String(txId),
    });
    res.status(result.confirmed ? 200 : 202).json(result);
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