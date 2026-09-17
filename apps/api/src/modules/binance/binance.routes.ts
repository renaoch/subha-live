import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  statusController,
  priceController,
  pricesController,
  balancesController,
  placeOrderController,
  orderStatusController,
  recentOrdersController,
  depositAddressController,
  verifyRechargeController,
} from "./binance.controller";

const router = Router();

// User-facing: no keys or balances leave the server, just live prices.
router.get("/status", authMiddleware, statusController);
router.get("/price/:symbol", authMiddleware, priceController);
router.get("/prices", authMiddleware, pricesController);

// User-facing: automated crypto recharge. Fully backend-verified against
// Binance's own deposit ledger — no admin approval step anywhere in this
// path (see binance.controller.ts / binance.service.ts).
router.get("/recharge/deposit-address", authMiddleware, depositAddressController);
router.post("/recharge/verify", authMiddleware, verifyRechargeController);

// Admin-only (checked inside controllers via assertIsPlatformAdmin):
// these sign and send real requests against the platform's Binance
// account using BINANCE_API_KEY / BINANCE_API_SECRET from the server
// environment.
router.get("/account/balances", authMiddleware, balancesController);
router.post("/orders", authMiddleware, placeOrderController);
router.get("/orders/:symbol/:orderId", authMiddleware, orderStatusController);
router.get("/orders", authMiddleware, recentOrdersController);

export default router;