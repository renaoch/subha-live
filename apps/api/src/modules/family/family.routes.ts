import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyFamily,
  getFamily,
  createFamilyController,
  joinFamilyController,
  leaveFamilyController,
} from "./family.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyFamily,
);

router.get(
  "/:id",
  getFamily,
);

router.post(
  "/",
  authMiddleware,
  createFamilyController,
);

router.post(
  "/:id/join",
  authMiddleware,
  joinFamilyController,
);

router.post(
  "/leave",
  authMiddleware,
  leaveFamilyController,
);

export default router;