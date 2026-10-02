import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import {
  applyReferral,
  getReferralHistory,
  getReferralOverview,
} from "./referral.controller";

const router = Router();

router.get("/referrals", authMiddleware, getReferralOverview);
router.post("/referrals/apply", authMiddleware, rateLimit("referrals:apply"), applyReferral);
router.get("/referrals/history", authMiddleware, getReferralHistory);

export default router;
