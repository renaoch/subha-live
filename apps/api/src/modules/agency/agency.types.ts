// File: apps/api/src/modules/agency/agency.types.ts

import type { Database } from "../../types/database.types";

export type Agency = Database["public"]["Tables"]["agencies"]["Row"];

export type AgencyHost = Database["public"]["Tables"]["agency_hosts"]["Row"] & {
  agent_id?: string | null;
};

export interface AgencySummary {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  commissionRate: number;
  monthlyRevenue: number;
  totalHosts: number;
  createdAt: string | null;
}

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

export interface MyAgencyResult {
  agency: AgencySummary | null;
  membershipStatus: string | null;
}

export interface AgencyDetailsResult {
  agency: AgencySummary;
  members: AgencyMember[];
}

export interface AgencyApplicationResult {
  agencyId: string;
  status: string | null;
  createdAt: string | null;
}

export interface AgencyListResult {
  agencies: AgencySummary[];
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface AgencyAgent {
  id: string;
  agencyId: string;
  userId: string;
  name: string;
  handle: string;
  avatar: string | null;
  commissionRate: number;
  status: string;
  hostCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export interface AgencyInvitation {
  id: string;
  agencyId: string;
  agencyName: string;
  hostId: string;
  hostName: string;
  hostHandle: string;
  hostAvatar: string | null;
  invitedBy: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

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

export interface AgencyTaskAssignment {
  id: string;
  taskId: string;
  hostId: string;
  progress: number;
  targetValue: number;
  status: "in_progress" | "completed" | "claimed" | "expired";
  completedAt: string | null;
  claimedAt: string | null;
}

export interface AgencyTaskWithAssignment extends AgencyTask {
  assignment: AgencyTaskAssignment | null;
}

export interface ClaimAgencyTaskResult {
  taskId: string;
  rewardCoins: number;
  rewardDiamonds: number;
  newCoins: number;
  newDiamonds: number;
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

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