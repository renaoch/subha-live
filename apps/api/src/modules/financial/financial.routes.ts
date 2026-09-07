import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  getGiftCatalogController,
  sendGiftController,
  getLedgerController,
  getMyEarningsController,
  requestWithdrawalController,
  getMyWithdrawalsController,
  listPendingWithdrawalsController,
  processWithdrawalController,
} from "./financial.controller";

const router = Router();

// Gift catalog is the server-side price list; publicly readable so the
// gift picker UI can render names/icons/prices, but prices here are what
// get charged — never what the client echoes back on /gifts/send.
router.get("/gifts/catalog", getGiftCatalogController);
router.post("/gifts/send", authMiddleware, sendGiftController);

router.get("/ledger", authMiddleware, getLedgerController);
router.get("/earnings/me", authMiddleware, getMyEarningsController);

router.post("/withdrawals", authMiddleware, requestWithdrawalController);
router.get("/withdrawals/me", authMiddleware, getMyWithdrawalsController);
router.get("/withdrawals/pending", authMiddleware, listPendingWithdrawalsController);
router.post("/withdrawals/:id/process", authMiddleware, processWithdrawalController);

export default router;
