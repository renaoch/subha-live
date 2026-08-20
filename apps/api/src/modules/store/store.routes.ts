import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getStoreController,
  getMyInventoryController,
  purchaseStoreItemController,
  equipInventoryItemController,
} from "./store.controller";

const router = Router();

/**
 * Public store catalog.
 */
router.get(
  "/",
  getStoreController,
);

/**
 * Authenticated user's inventory.
 */
router.get(
  "/inventory",
  authMiddleware,
  getMyInventoryController,
);

/**
 * Purchase an item.
 */
router.post(
  "/:id/purchase",
  authMiddleware,
  purchaseStoreItemController,
);

/**
 * Equip an owned item.
 */
router.post(
  "/inventory/:id/equip",
  authMiddleware,
  equipInventoryItemController,
);

export default router;