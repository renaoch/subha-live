import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyTasksController,
  claimTaskController,
} from "./tasks.controller";

const router = Router();

router.get(
  "/",
  authMiddleware,
  getMyTasksController,
);

router.post(
  "/:id/claim",
  authMiddleware,
  claimTaskController,
);

export default router;