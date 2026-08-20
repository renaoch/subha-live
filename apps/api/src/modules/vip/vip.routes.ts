import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyVipController,
  getMyVipSubscriptionController,
} from "./vip.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyVipController,
);

router.get(
  "/subscriptions/:id",
  authMiddleware,
  getMyVipSubscriptionController,
);

export default router;