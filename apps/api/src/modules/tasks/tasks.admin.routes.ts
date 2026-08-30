import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  adminListTasksController,
  adminCreateTaskController,
  adminUpdateTaskController,
  adminDeleteTaskController,
} from "./tasks.controller";

const router = Router();

// Platform-admin only (checked inside each controller).
router.get("/", authMiddleware, adminListTasksController);
router.post("/", authMiddleware, adminCreateTaskController);
router.patch("/:id", authMiddleware, adminUpdateTaskController);
router.delete("/:id", authMiddleware, adminDeleteTaskController);

export default router;
