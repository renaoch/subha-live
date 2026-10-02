import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { rateLimit } from "../../lib/rate-limit";
import {
  claimDailyReward,
  getDailyRewardHistory,
  getDailyRewardOverview,
} from "./daily-reward.controller";

const router = Router();

router.get("/rewards/daily", authMiddleware, getDailyRewardOverview);
router.post("/rewards/daily/claim", authMiddleware, rateLimit("rewards:claim"), claimDailyReward);
router.get("/rewards/daily/history", authMiddleware, getDailyRewardHistory);

export default router;
