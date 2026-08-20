import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyBdController,
  createBdApplicationController,
} from "./bd.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyBdController,
);

router.post(
  "/apply",
  authMiddleware,
  createBdApplicationController,
);

export default router;