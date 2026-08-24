import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  getMyBdController,
  createBdApplicationController,
  listBdApplicationsController,
  approveBdApplicationController,
  rejectBdApplicationController,
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

/* ========================================================================== */
/* ADMIN                                                                      */
/* authMiddleware only checks the user is logged in — the service layer      */
/* (listBdApplications / approveBdApplication / rejectBdApplication) already */
/* verifies profiles.is_admin and throws a 403 for non-admins.               */
/* ========================================================================== */

router.get(
  "/applications",
  authMiddleware,
  listBdApplicationsController,
);

router.post(
  "/applications/:id/approve",
  authMiddleware,
  approveBdApplicationController,
);

router.post(
  "/applications/:id/reject",
  authMiddleware,
  rejectBdApplicationController,
);

export default router;