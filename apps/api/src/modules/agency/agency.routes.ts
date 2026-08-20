import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  listAgencies,
  getMyAgencyController,
  getAgency,
  joinAgency,
  leaveMyAgency,
  getApplications,
  approveApplication,
  rejectApplication,
} from "./agency.controller";

const router = Router();

/*
 * Public agency discovery.
 */
router.get(
  "/",
  listAgencies,
);

/*
 * Authenticated user's agency.
 */
router.get(
  "/me",
  authMiddleware,
  getMyAgencyController,
);

/*
 * Public agency details.
 */
router.get(
  "/:id",
  getAgency,
);

/*
 * Request to join.
 */
router.post(
  "/:id/join",
  authMiddleware,
  joinAgency,
);

/*
 * Leave current agency.
 */
router.post(
  "/leave",
  authMiddleware,
  leaveMyAgency,
);

/*
 * Agency owner application management.
 */
router.get(
  "/:id/applications",
  authMiddleware,
  getApplications,
);

router.post(
  "/:id/applications/:userId/approve",
  authMiddleware,
  approveApplication,
);

router.post(
  "/:id/applications/:userId/reject",
  authMiddleware,
  rejectApplication,
);

export default router;