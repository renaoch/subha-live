import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  requestRechargeController,
  getMyRechargesController,
  listPendingRechargesController,
  approveRechargeController,
  listPendingRechargesForAgencyController,
  approveRechargeAsAgencyController,
} from "./offline-recharge.controller";

const router = Router();

// User endpoints
router.post("/request", authMiddleware, requestRechargeController);
router.get("/my-requests", authMiddleware, getMyRechargesController);

// Platform admin endpoints — listPendingRecharges/approveRecharge enforce
// assertIsPlatformAdmin() themselves.
router.get("/admin/pending", authMiddleware, listPendingRechargesController);
router.put("/admin/requests/:id/approve", authMiddleware, approveRechargeController);

// Agency owner endpoints — scoped to hosts in the caller's own agency
// (see offline-recharge.service.ts#listPendingRechargesForAgency /
// #approveRechargeAsAgency for the authorization checks).
router.get("/agency/pending", authMiddleware, listPendingRechargesForAgencyController);
router.put("/agency/requests/:id/approve", authMiddleware, approveRechargeAsAgencyController);

export default router;
