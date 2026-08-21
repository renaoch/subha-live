// File: apps/api/src/modules/agency/agency.types.ts

import type { Database } from "../../types/database.types";

/* ========================================================================== */
/* DATABASE TYPES                                                             */
/* ========================================================================== */

export type Agency =
  Database["public"]["Tables"]["agencies"]["Row"];

export type AgencyHost =
  Database["public"]["Tables"]["agency_hosts"]["Row"] & {
    agent_id?: string | null;
  };

/* ========================================================================== */
/* AGENCY SUMMARY                                                             */
/* ========================================================================== */

/**
 * Public agency information.
 *
 * IMPORTANT:
 *
 * `code` is intentionally NOT included here.
 *
 * Agency codes are private and must never be returned by:
 *
 * GET /agencies
 * GET /agencies/:id
 * GET /agencies/me
 * GET /agencies/:id/dashboard
 */
export interface AgencySummary {
  id: string;

  name: string;

  ownerId: string;

  commissionRate: number;

  monthlyRevenue: number;

  totalHosts: number;

  createdAt: string | null;
}

/* ========================================================================== */
/* PRIVATE AGENCY                                                             */
/* ========================================================================== */

/**
 * Internal/private agency representation.
 *
 * Only backend code that explicitly needs to validate the
 * agency join code should use this type.
 *
 * NEVER return this directly from a public controller.
 */
export interface PrivateAgency {
  id: string;

  code: string;

  name: string;

  ownerId: string;

  commissionRate: number;

  monthlyRevenue: number;

  totalHosts: number;

  createdAt: string | null;
}

/* ========================================================================== */
/* AGENCY MEMBER                                                              */
/* ========================================================================== */

export interface AgencyMember {
  userId: string;

  name: string;

  handle: string;

  avatar: string | null;

  country: string | null;

  countryFlag: string | null;

  level: number;

  status: string | null;

  joinedAt: string | null;

  agentId?: string | null;
}

/* ========================================================================== */
/* MY AGENCY                                                                  */
/* ========================================================================== */

export type AgencyMembershipStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "left"
  | null;

export interface MyAgencyResult {
  agency: AgencySummary | null;

  membershipStatus: AgencyMembershipStatus;
}

/* ========================================================================== */
/* AGENCY DETAILS                                                             */
/* ========================================================================== */

export interface AgencyDetailsResult {
  agency: AgencySummary;

  members: AgencyMember[];
}

/* ========================================================================== */
/* APPLICATION                                                                */
/* ========================================================================== */

export type AgencyApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface AgencyApplicationResult {
  agencyId: string;

  status: AgencyApplicationStatus | null;

  createdAt: string | null;
}

/* ========================================================================== */
/* AGENCY LIST                                                                */
/* ========================================================================== */

export interface AgencyListResult {
  agencies: AgencySummary[];
}

/* ========================================================================== */
/* AGENTS                                                                     */
/* ========================================================================== */

export type AgencyAgentStatus =
  | "active"
  | "suspended"
  | "removed";

export interface AgencyAgent {
  id: string;

  agencyId: string;

  userId: string;

  name: string;

  handle: string;

  avatar: string | null;

  commissionRate: number;

  status: AgencyAgentStatus;

  hostCount: number;

  createdAt: string;
}

/* ========================================================================== */
/* INVITATIONS                                                                */
/* ========================================================================== */

export type AgencyInvitationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired";

export interface AgencyInvitation {
  id: string;

  agencyId: string;

  agencyName: string;

  hostId: string;

  hostName: string;

  hostHandle: string;

  hostAvatar: string | null;

  invitedBy: string;

  status: AgencyInvitationStatus;

  createdAt: string;

  respondedAt: string | null;

  expiresAt: string | null;
}

/* ========================================================================== */
/* DASHBOARD                                                                  */
/* ========================================================================== */

export interface AgencyDashboard {
  agency: AgencySummary;

  totalHosts: number;

  activeHosts: number;

  agentCount: number;

  pendingApplications: number;

  pendingInvitations: number;

  activeTasks: number;

  pendingPayouts: number;
}

/* ========================================================================== */
/* TASKS                                                                      */
/* ========================================================================== */

export type AgencyTaskType =
  | "stream_hours"
  | "stream_days"
  | "gift_amount"
  | "gift_count"
  | "viewer_count"
  | "followers"
  | "live_sessions"
  | "recruit_hosts"
  | "custom";

export interface AgencyTask {
  id: string;

  agencyId: string;

  title: string;

  description: string | null;

  type: AgencyTaskType;

  targetValue: number;

  rewardCoins: number;

  rewardDiamonds: number;

  startAt: string;

  endAt: string | null;

  status: string;

  assignedCount: number;

  completedCount: number;

  createdAt: string;
}

/* ========================================================================== */
/* TASK ASSIGNMENT                                                            */
/* ========================================================================== */

export interface AgencyTaskAssignment {
  id: string;

  taskId: string;

  hostId: string;

  progress: number;

  targetValue: number;

  status:
    | "in_progress"
    | "completed"
    | "claimed"
    | "expired";

  completedAt: string | null;

  claimedAt: string | null;
}

export interface AgencyTaskWithAssignment
  extends AgencyTask {
  assignment:
    | AgencyTaskAssignment
    | null;
}

/* ========================================================================== */
/* CLAIM TASK                                                                 */
/* ========================================================================== */

export interface ClaimAgencyTaskResult {
  taskId: string;

  rewardCoins: number;

  rewardDiamonds: number;

  newCoins: number;

  newDiamonds: number;
}

/* ========================================================================== */
/* PAYOUTS                                                                    */
/* ========================================================================== */

export type PayoutStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"
  | "failed"
  | "cancelled";

export interface Payout {
  id: string;

  agencyId: string;

  requestedBy: string;

  amount: number;

  status: PayoutStatus;

  note: string | null;

  requestedAt: string;

  processedAt: string | null;

  paidAt: string | null;
}