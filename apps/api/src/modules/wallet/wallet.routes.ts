import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  getWalletController,
  purchaseCoinsController,
  requestWithdrawalController,
  cryptoQuoteController,
  cryptoVerifyController,
} from "./wallet.controller";

const router = Router();

router.get("/me", authMiddleware, getWalletController);
router.post("/purchase", authMiddleware, purchaseCoinsController);
router.post("/withdraw", authMiddleware, requestWithdrawalController);

// Crypto (Binance) recharge: quote the deposit address + amount, then
// verify a submitted txId against Binance's own deposit record before
// crediting coins.
router.get("/crypto/quote/:packageId", authMiddleware, cryptoQuoteController);
router.post("/crypto/verify", authMiddleware, cryptoVerifyController);

export default router;