import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyCpController,
  getCpController,
  createCpController,
  endCpController,
} from "./cp.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyCpController,
);

router.get(
  "/:id",
  getCpController,
);

router.post(
  "/",
  authMiddleware,
  createCpController,
);

router.post(
  "/:id/end",
  authMiddleware,
  endCpController,
);

export default router;