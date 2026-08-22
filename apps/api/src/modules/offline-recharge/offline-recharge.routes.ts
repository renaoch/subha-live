import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  requestRechargeController,
  getMyRechargesController,
  listPendingRechargesController,
  approveRechargeController,
} from "./offline-recharge.controller";

const router = Router();

// User endpoints
router.post("/request", authMiddleware, requestRechargeController);
router.get("/my-requests", authMiddleware, getMyRechargesController);

// Admin endpoints (can be restricted to admins/agency owners later)
router.get("/admin/pending", authMiddleware, listPendingRechargesController);
router.put("/admin/requests/:id/approve", authMiddleware, approveRechargeController);

export default router;