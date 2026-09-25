import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import {
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

// Admin — credit the trading market (agency coin purchase).
router.post("/trading/credit", authMiddleware, rateLimit("trading:credit"), creditTrading);

export default router;
