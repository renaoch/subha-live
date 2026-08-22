import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyCharismaController,
  getMyGiftsController,
  sendGiftController,
} from "./charisma.controller";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyCharismaController,
);

router.get(
  "/gifts",
  authMiddleware,
  getMyGiftsController,
);

router.post(
  "/send",
  authMiddleware,
  sendGiftController,
);

export default router;

/**
 * Mount this alongside your existing levels router, e.g.:
 *
 *   import levelsRoutes from "./modules/levels/levels.routes";
 *   import charismaRoutes from "./modules/charisma/charisma.routes";
 *
 *   app.use("/api/v1/levels", levelsRoutes);
 *   app.use("/api/v1/charisma", charismaRoutes);
 */