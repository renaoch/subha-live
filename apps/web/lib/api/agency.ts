// File: apps/web/lib/api/agency.ts

import { apiFetch } from "@/lib/api/client";

export interface Agency {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  commissionRate: number;
  monthlyRevenue: number;
  totalHosts: number;
  createdAt: string;
}

export interface AgencyMember {
  agencyId: string;
  hostId: string;
  joinedAt: string | null;
  status: string | null;
}

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

export interface AgencyDashboard {
  agency: Agency;
  totalHosts: number;
  activeHosts: number;
  agentCount: number;
  pendingApplications: number;
  pendingInvitations: number;
  activeTasks: number;
  pendingPayouts: number;
}

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
  assignment: AgencyTaskAssignment | null;
}

export interface ClaimAgencyTaskResult {
  taskId: string;
  rewardCoins: number;
  rewardDiamonds: number;
  newCoins: number;
  newDiamonds: number;
}

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

interface AgencyListResponse {
  status: string;
  agencies: Agency[];
}

interface AgencyResponse {
  status: string;
  agency: Agency;
}

interface MyAgencyResponse {
  status: string;
  agency: Agency | null;
  membershipStatus: string | null;
}

export const agencyApi = {
  list() {
    return apiFetch<AgencyListResponse>("/api/v1/agency").then((r) => r.agencies);
  },

  get(id: string) {
    return apiFetch<AgencyResponse>(`/api/v1/agency/${id}`).then((r) => r.agency);
  },

  me() {
    return apiFetch<MyAgencyResponse>("/api/v1/agency/me");
  },

  join(id: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${id}/join`, { method: "POST" });
  },

  leave() {
    return apiFetch<void>("/api/v1/agency/leave", { method: "POST" });
  },

  applications(id: string) {
    return apiFetch<{ status: string; applications: unknown[] }>(`/api/v1/agency/${id}/applications`).then(
      (r) => r.applications,
    );
  },

  approveApplication(agencyId: string, userId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/applications/${userId}/approve`, {
      method: "POST",
    });
  },

  rejectApplication(agencyId: string, userId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/applications/${userId}/reject`, {
      method: "POST",
    });
  },

  dashboard(id: string) {
    return apiFetch<{ status: string; dashboard: AgencyDashboard }>(`/api/v1/agency/${id}/dashboard`).then(
      (r) => r.dashboard,
    );
  },

  // Agents -------------------------------------------------------------

  agents(id: string) {
    return apiFetch<{ status: string; agents: AgencyAgent[] }>(`/api/v1/agency/${id}/agents`).then((r) => r.agents);
  },

  addAgent(agencyId: string, userId: string, commissionRate?: number) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/agents`, {
      method: "POST",
      body: JSON.stringify({ userId, commissionRate }),
    });
  },

  removeAgent(agencyId: string, agentId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/agents/${agentId}`, { method: "DELETE" });
  },

  suspendAgent(agencyId: string, agentId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/agents/${agentId}/suspend`, { method: "POST" });
  },

  // Host management ------------------------------------------------------

  assignHostAgent(agencyId: string, hostId: string, agentId: string | null) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/hosts/${hostId}/agent`, {
      method: "PATCH",
      body: JSON.stringify({ agentId }),
    });
  },

  suspendHost(agencyId: string, hostId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/hosts/${hostId}/suspend`, { method: "POST" });
  },

  removeHost(agencyId: string, hostId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/hosts/${hostId}/remove`, { method: "POST" });
  },

  // Invitations ------------------------------------------------------------

  invitations(agencyId: string) {
    return apiFetch<{ status: string; invitations: AgencyInvitation[] }>(
      `/api/v1/agency/${agencyId}/invitations`,
    ).then((r) => r.invitations);
  },

  myInvitations() {
    return apiFetch<{ status: string; invitations: AgencyInvitation[] }>("/api/v1/agency/me/invitations").then(
      (r) => r.invitations,
    );
  },

  inviteHost(agencyId: string, hostId: string, expiresInDays?: number) {
    return apiFetch<{ status: string }>(`/api/v1/agency/${agencyId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ hostId, expiresInDays }),
    });
  },

  acceptInvitation(invitationId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/invitations/${invitationId}/accept`, { method: "POST" });
  },

  rejectInvitation(invitationId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/invitations/${invitationId}/reject`, { method: "POST" });
  },

  cancelInvitation(invitationId: string) {
    return apiFetch<{ status: string }>(`/api/v1/agency/invitations/${invitationId}/cancel`, { method: "POST" });
  },

  // Tasks --------------------------------------------------------------

  tasks(agencyId: string) {
    return apiFetch<{ status: string; tasks: AgencyTask[] }>(`/api/v1/agency/${agencyId}/tasks`).then(
      (r) => r.tasks,
    );
  },

  createTask(
    agencyId: string,
    input: {
      title: string;
      description?: string;
      type: AgencyTaskType;
      targetValue: number;
      rewardCoins?: number;
      rewardDiamonds?: number;
      endAt?: string;
    },
  ) {
    return apiFetch<{ status: string; task: AgencyTask }>(`/api/v1/agency/${agencyId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.task);
  },

  claimTask(agencyId: string, taskId: string) {
    return apiFetch<{ status: string; task: ClaimAgencyTaskResult }>(
      `/api/v1/agency/${agencyId}/tasks/${taskId}/claim`,
      { method: "POST" },
    ).then((r) => r.task);
  },

  // Payouts --------------------------------------------------------------

  payouts(agencyId: string) {
    return apiFetch<{ status: string; payouts: Payout[] }>(`/api/v1/agency/${agencyId}/payouts`).then(
      (r) => r.payouts,
    );
  },

  requestPayout(agencyId: string, amount: number, note?: string) {
    return apiFetch<{ status: string; payout: Payout }>(`/api/v1/agency/${agencyId}/payouts`, {
      method: "POST",
      body: JSON.stringify({ amount, note }),
    }).then((r) => r.payout);
  },

  updatePayoutStatus(payoutId: string, status: PayoutStatus) {
    return apiFetch<{ status: string; payout: Payout }>(`/api/v1/agency/payouts/${payoutId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }).then((r) => r.payout);
  },
};