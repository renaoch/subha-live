// File: apps/api/src/modules/agency/agency.routes.ts

import { Router } from "express";

import { authMiddleware } from "../auth/auth.middleware";

import {
  /* ---------------------------------------------------------------------- */
  /* Agency                                                                  */
  /* ---------------------------------------------------------------------- */

  listAgencies,
  getMyAgencyController,
  getAgency,

  joinAgency,
  leaveMyAgency,

  /* ---------------------------------------------------------------------- */
  /* Applications                                                            */
  /* ---------------------------------------------------------------------- */

  getApplications,
  approveApplication,
  rejectApplication,

  /* ---------------------------------------------------------------------- */
  /* Agents                                                                  */
  /* ---------------------------------------------------------------------- */

  getAgents,
  createAgent,
  deleteAgent,
  suspendAgentController,

  /* ---------------------------------------------------------------------- */
  /* Hosts                                                                   */
  /* ---------------------------------------------------------------------- */

  assignHostAgent,
  suspendHost,
  restoreHost,
  removeHost,

  /* ---------------------------------------------------------------------- */
  /* Invitations                                                             */
  /* ---------------------------------------------------------------------- */

  createAgencyInvitation,
  getAgencyInvitations,
  getMyInvitations,
  acceptAgencyInvitation,
  rejectAgencyInvitation,
  cancelAgencyInvitation,

  /* ---------------------------------------------------------------------- */
  /* Dashboard                                                               */
  /* ---------------------------------------------------------------------- */

  getDashboard,

  /* ---------------------------------------------------------------------- */
  /* Tasks                                                                   */
  /* ---------------------------------------------------------------------- */

  createTask,
  getTasks,
  claimTaskReward,

  /* ---------------------------------------------------------------------- */
  /* Payouts                                                                 */
  /* ---------------------------------------------------------------------- */

  createPayout,
  getPayouts,
  updatePayoutStatusController,
} from "./agency.controller";

const router = Router();

/* ========================================================================== */
/* PUBLIC AGENCY DISCOVERY                                                    */
/* ========================================================================== */

/*
 * GET /agencies
 *
 * Anyone can discover agencies.
 */
router.get(
  "/",
  listAgencies,
);

/* ========================================================================== */
/* AUTHENTICATED USER ROUTES                                                  */
/* ========================================================================== */

/*
 * GET /agencies/me
 *
 * Returns:
 *
 * - no agency
 * - pending agency
 * - approved agency
 */
router.get(
  "/me",
  authMiddleware,
  getMyAgencyController,
);

/*
 * POST /agencies/leave
 *
 * Allows a user to:
 *
 * - cancel a pending application
 * - leave an approved agency
 */
router.post(
  "/leave",
  authMiddleware,
  leaveMyAgency,
);

/* ========================================================================== */
/* HOST INVITATIONS                                                           */
/* ========================================================================== */

/*
 * GET /agencies/me/invitations
 *
 * Current user's pending agency invitations.
 *
 * Keep this BEFORE /:id routes.
 */
router.get(
  "/me/invitations",
  authMiddleware,
  getMyInvitations,
);

/*
 * POST /agencies/invitations/:invitationId/accept
 */
router.post(
  "/invitations/:invitationId/accept",
  authMiddleware,
  acceptAgencyInvitation,
);

/*
 * POST /agencies/invitations/:invitationId/reject
 */
router.post(
  "/invitations/:invitationId/reject",
  authMiddleware,
  rejectAgencyInvitation,
);

/*
 * POST /agencies/invitations/:invitationId/cancel
 *
 * This is normally used by the agency side,
 * and the service checks ownership.
 */
router.post(
  "/invitations/:invitationId/cancel",
  authMiddleware,
  cancelAgencyInvitation,
);

/* ========================================================================== */
/* ADMIN PAYOUT ROUTE                                                         */
/* ========================================================================== */

/*
 * POST /agencies/payouts/:payoutId/status
 *
 * Admin-only authorization is performed inside
 * adminUpdatePayoutStatus().
 */
router.post(
  "/payouts/:payoutId/status",
  authMiddleware,
  updatePayoutStatusController,
);

/* ========================================================================== */
/* AGENCY JOIN                                                                */
/* ========================================================================== */

/*
 * POST /agencies/:id/join
 *
 * Body:
 *
 * {
 *   "code": "ABC123"
 * }
 *
 * Flow:
 *
 * User
 *   ↓
 * enters agency code
 *   ↓
 * backend verifies code
 *   ↓
 * agency_hosts.status = pending
 *   ↓
 * owner reviews application
 */
router.post(
  "/:id/join",
  authMiddleware,
  joinAgency,
);

/* ========================================================================== */
/* AGENCY DETAILS                                                             */
/* ========================================================================== */

/*
 * GET /agencies/:id
 *
 * Public agency information.
 *
 * IMPORTANT:
 * This should NOT expose the private agency code.
 *
 * The service currently returns the code in AgencySummary,
 * so if this endpoint is genuinely public, we should later
 * remove `code` from the public response.
 */
router.get(
  "/:id",
  getAgency,
);

/* ========================================================================== */
/* APPLICATION MANAGEMENT                                                     */
/* ========================================================================== */

/*
 * GET /agencies/:id/applications
 *
 * Owner only.
 */
router.get(
  "/:id/applications",
  authMiddleware,
  getApplications,
);

/*
 * POST /agencies/:id/applications/:userId/approve
 *
 * Owner only.
 */
router.post(
  "/:id/applications/:userId/approve",
  authMiddleware,
  approveApplication,
);

/*
 * POST /agencies/:id/applications/:userId/reject
 *
 * Owner only.
 */
router.post(
  "/:id/applications/:userId/reject",
  authMiddleware,
  rejectApplication,
);

/* ========================================================================== */
/* DASHBOARD                                                                  */
/* ========================================================================== */

/*
 * GET /agencies/:id/dashboard
 *
 * Owner only.
 */
router.get(
  "/:id/dashboard",
  authMiddleware,
  getDashboard,
);

/* ========================================================================== */
/* AGENTS                                                                     */
/* ========================================================================== */

/*
 * GET /agencies/:id/agents
 */
router.get(
  "/:id/agents",
  authMiddleware,
  getAgents,
);

/*
 * POST /agencies/:id/agents
 */
router.post(
  "/:id/agents",
  authMiddleware,
  createAgent,
);

/*
 * DELETE /agencies/:id/agents/:agentId
 */
router.delete(
  "/:id/agents/:agentId",
  authMiddleware,
  deleteAgent,
);

/*
 * POST /agencies/:id/agents/:agentId/suspend
 */
router.post(
  "/:id/agents/:agentId/suspend",
  authMiddleware,
  suspendAgentController,
);

/* ========================================================================== */
/* HOST MANAGEMENT                                                            */
/* ========================================================================== */

/*
 * PATCH /agencies/:id/hosts/:hostId/agent
 *
 * Assign/remove an agent.
 *
 * Body:
 *
 * {
 *   "agentId": "uuid"
 * }
 *
 * Or:
 *
 * {
 *   "agentId": null
 * }
 */
router.patch(
  "/:id/hosts/:hostId/agent",
  authMiddleware,
  assignHostAgent,
);

/*
 * POST /agencies/:id/hosts/:hostId/suspend
 */
router.post(
  "/:id/hosts/:hostId/suspend",
  authMiddleware,
  suspendHost,
);

/*
 * POST /agencies/:id/hosts/:hostId/restore
 *
 * Suspended → approved.
 */
router.post(
  "/:id/hosts/:hostId/restore",
  authMiddleware,
  restoreHost,
);

/*
 * POST /agencies/:id/hosts/:hostId/remove
 *
 * Owner removes host from agency.
 */
router.post(
  "/:id/hosts/:hostId/remove",
  authMiddleware,
  removeHost,
);

/* ========================================================================== */
/* AGENCY-INITIATED INVITATIONS                                               */
/* ========================================================================== */

/*
 * GET /agencies/:id/invitations
 *
 * Owner sees invitations sent by the agency.
 */
router.get(
  "/:id/invitations",
  authMiddleware,
  getAgencyInvitations,
);

/*
 * POST /agencies/:id/invitations
 *
 * Body:
 *
 * {
 *   "hostId": "uuid",
 *   "expiresInDays": 7
 * }
 */
router.post(
  "/:id/invitations",
  authMiddleware,
  createAgencyInvitation,
);

/* ========================================================================== */
/* TASKS                                                                      */
/* ========================================================================== */

/*
 * GET /agencies/:id/tasks
 */
router.get(
  "/:id/tasks",
  authMiddleware,
  getTasks,
);

/*
 * POST /agencies/:id/tasks
 */
router.post(
  "/:id/tasks",
  authMiddleware,
  createTask,
);

/*
 * POST /agencies/:id/tasks/:taskId/claim
 */
router.post(
  "/:id/tasks/:taskId/claim",
  authMiddleware,
  claimTaskReward,
);

/* ========================================================================== */
/* PAYOUTS                                                                    */
/* ========================================================================== */

/*
 * GET /agencies/:id/payouts
 */
router.get(
  "/:id/payouts",
  authMiddleware,
  getPayouts,
);

/*
 * POST /agencies/:id/payouts
 */
router.post(
  "/:id/payouts",
  authMiddleware,
  createPayout,
);

/* ========================================================================== */
/* EXPORT                                                                     */
/* ========================================================================== */

export default router;