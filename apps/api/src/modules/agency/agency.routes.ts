// File: apps/api/src/modules/agency/agency.routes.ts

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
  getAgents,
  createAgent,
  deleteAgent,
  suspendAgentController,
  assignHostAgent,
  suspendHost,
  removeHost,
  createAgencyInvitation,
  getAgencyInvitations,
  getMyInvitations,
  acceptAgencyInvitation,
  rejectAgencyInvitation,
  cancelAgencyInvitation,
  getDashboard,
  createTask,
  getTasks,
  claimTaskReward,
  createPayout,
  getPayouts,
  updatePayoutStatusController,
} from "./agency.controller";

const router = Router();

/*
 * Public agency discovery.
 */
router.get("/", listAgencies);

/*
 * Authenticated user's agency.
 */
router.get("/me", authMiddleware, getMyAgencyController);

/*
 * Host's own pending invitations. Must come before "/:id" so it isn't
 * swallowed by the dynamic param route.
 */
router.get("/me/invitations", authMiddleware, getMyInvitations);

/*
 * Invitation actions (host side). Not nested under an agency ID since the
 * invitation ID alone identifies the agency.
 */
router.post("/invitations/:invitationId/accept", authMiddleware, acceptAgencyInvitation);
router.post("/invitations/:invitationId/reject", authMiddleware, rejectAgencyInvitation);
router.post("/invitations/:invitationId/cancel", authMiddleware, cancelAgencyInvitation);

/*
 * Payout status (admin).
 */
router.post("/payouts/:payoutId/status", authMiddleware, updatePayoutStatusController);

/*
 * Public agency details.
 */
router.get("/:id", getAgency);

/*
 * Request to join.
 */
router.post("/:id/join", authMiddleware, joinAgency);

/*
 * Leave current agency.
 */
router.post("/leave", authMiddleware, leaveMyAgency);

/*
 * Agency owner application management (host-initiated join requests).
 */
router.get("/:id/applications", authMiddleware, getApplications);
router.post("/:id/applications/:userId/approve", authMiddleware, approveApplication);
router.post("/:id/applications/:userId/reject", authMiddleware, rejectApplication);

/*
 * Dashboard.
 */
router.get("/:id/dashboard", authMiddleware, getDashboard);

/*
 * Agents.
 */
router.get("/:id/agents", authMiddleware, getAgents);
router.post("/:id/agents", authMiddleware, createAgent);
router.delete("/:id/agents/:agentId", authMiddleware, deleteAgent);
router.post("/:id/agents/:agentId/suspend", authMiddleware, suspendAgentController);

/*
 * Host management.
 */
router.patch("/:id/hosts/:hostId/agent", authMiddleware, assignHostAgent);
router.post("/:id/hosts/:hostId/suspend", authMiddleware, suspendHost);
router.post("/:id/hosts/:hostId/remove", authMiddleware, removeHost);

/*
 * Invitations (agency-initiated, distinct from host join requests above).
 */
router.get("/:id/invitations", authMiddleware, getAgencyInvitations);
router.post("/:id/invitations", authMiddleware, createAgencyInvitation);

/*
 * Agency tasks.
 */
router.get("/:id/tasks", authMiddleware, getTasks);
router.post("/:id/tasks", authMiddleware, createTask);
router.post("/:id/tasks/:taskId/claim", authMiddleware, claimTaskReward);

/*
 * Payouts.
 */
router.get("/:id/payouts", authMiddleware, getPayouts);
router.post("/:id/payouts", authMiddleware, createPayout);

export default router;