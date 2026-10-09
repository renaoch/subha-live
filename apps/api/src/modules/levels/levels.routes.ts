import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyLevelController,
  getLevelRewardsController,
  getMyLevelHistoryController,
  getLevelDefinitionsController,
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

router.get(
  "/definitions",
  authMiddleware,
  getLevelDefinitionsController,
);

export default router;