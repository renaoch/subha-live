import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  getWalletController,
  purchaseCoinsController,
  requestWithdrawalController,
} from "./wallet.controller";

const router = Router();

router.get("/me", authMiddleware, getWalletController);
router.post("/purchase", authMiddleware, purchaseCoinsController);
router.post("/withdraw", authMiddleware, requestWithdrawalController);

export default router;