import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import {
  createCoinOrder,
  getCoinOrder,
  listCoinOrders,
  verifyCoinOrder,
  creditTrading,
  getTradingOverview,
  getTradingTransactions,
  payHost,
  verifyHost,
} from "./trading.controller";

const router = Router();

// Agency Owner — trading account + activity.
router.get("/trading/account", authMiddleware, getTradingOverview);
router.get("/trading/transactions", authMiddleware, getTradingTransactions);

// Host verification (rate-limited to curb enumeration).
router.post("/trading/hosts/verify", authMiddleware, rateLimit("trading:verify"), verifyHost);

// Host payment (rate-limited; idempotent + atomic server-side).
router.post("/trading/payments", authMiddleware, rateLimit("trading:pay"), payHost);

// Agency coin purchase — automated, Binance-verified (no admin step).
router.post("/trading/coin-orders", authMiddleware, rateLimit("trading:order:create", { max: 5, windowSeconds: 60 }), createCoinOrder);
router.get("/trading/coin-orders", authMiddleware, listCoinOrders);
router.get("/trading/coin-orders/:id", authMiddleware, getCoinOrder);
router.post("/trading/coin-orders/:id/verify", authMiddleware, rateLimit("trading:order:verify", { max: 6, windowSeconds: 30 }), verifyCoinOrder);

// Admin — credit the trading market (agency coin purchase).
router.post("/trading/credit", authMiddleware, rateLimit("trading:credit"), creditTrading);

export default router;