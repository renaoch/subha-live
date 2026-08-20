import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyLevelController,
  getLevelRewardsController,
  getMyLevelHistoryController,
} from "./levels.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyLevelController,
);

router.get(
  "/rewards",
  authMiddleware,
  getLevelRewardsController,
);

router.get(
  "/history",
  authMiddleware,
  getMyLevelHistoryController,
);

export default router;