// File: apps/web/lib/api/agency.ts

import { api } from "./client";

/* ============================================================================
 * BASE
 * ========================================================================== */

const AGENCY_BASE = "/api/v1/agency";

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type AgencyMembershipStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "left";

export interface Agency {
  id: string;
  name: string;
  code?: string;

  description?: string | null;
  country?: string | null;
  countryFlag?: string | null;
  avatar?: string | null;

  ownerId: string;

  totalHosts: number;
  activeHosts?: number;

  monthlyRevenue: number;
  totalRevenue?: number;

  commissionRate?: number;

  membershipStatus?: AgencyMembershipStatus | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

/* ============================================================================
 * APPLICATIONS
 * ========================================================================== */

export type AgencyApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface AgencyApplication {
  id: string;
  agencyId: string;
  userId: string;

  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  countryFlag: string | null;
  level: number;

  status: AgencyApplicationStatus;

  createdAt: string | null;
  updatedAt?: string | null;
}

/* ============================================================================
 * HOSTS
 * ========================================================================== */

export type AgencyHostStatus =
  | "pending"
  | "approved"
  | "suspended"
  | "removed"
  | "left";

export interface AgencyHost {
  id: string;
  agencyId: string;
  userId: string;

  status: AgencyHostStatus;

  commissionRate?: number;

  joinedAt?: string | null;
  updatedAt?: string | null;

  agentId?: string | null; // ✅ ADDED THIS LINE

  user?: {
    id: string;
    name: string;
    handle: string;
    avatar?: string | null;
    level?: number;
    country?: string | null;
    countryFlag?: string | null;
  };
}

/* ============================================================================
 * AGENTS
 * ========================================================================== */

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

/* ============================================================================
 * DASHBOARD
 * ========================================================================== */

export interface AgencyDashboard {
  agency?: Agency;

  totalHosts: number;
  activeHosts: number;

  pendingApplications: number;
  pendingInvitations: number;

  activeTasks: number;
  pendingPayouts: number;

  monthlyRevenue: number;
  totalRevenue: number;
}

/* ============================================================================
 * JOIN
 * ========================================================================== */

export interface AgencyJoinResponse {
  agency?: Agency;

  application?: {
    id?: string;
    agencyId: string;
    status: AgencyApplicationStatus;
    createdAt: string | null;
  };

  membership?: {
    id?: string;
    status: AgencyMembershipStatus;
  };

  membershipStatus:
    | AgencyMembershipStatus
    | null;
}

/* ============================================================================
 * INVITATIONS
 * ========================================================================== */

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

/* ============================================================================
 * TASKS
 * ========================================================================== */

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

export type AgencyTaskAssignmentStatus =
  | "in_progress"
  | "completed"
  | "claimed"
  | "expired";

export interface AgencyTaskAssignment {
  id: string;

  taskId: string;
  hostId: string;

  progress: number;
  targetValue: number;

  status: AgencyTaskAssignmentStatus;

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

/* ============================================================================
 * PAYOUTS
 * ========================================================================== */

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

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function unwrap<T>(
  response: unknown,
): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response
  ) {
    return (
      response as {
        data: T;
      }
    ).data;
  }

  return response as T;
}

function getArray(
  value: any,
  key: string,
): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    Array.isArray(value[key])
  ) {
    return value[key];
  }

  return [];
}

function normalizeApplication(
  application: any,
): AgencyApplication {
  const user =
    application?.user ??
    {};

  return {
    id: String(
      application?.id ?? "",
    ),

    agencyId: String(
      application?.agencyId ?? "",
    ),

    userId: String(
      application?.userId ??
        user?.id ??
        "",
    ),

    name:
      application?.name ??
      user?.name ??
      "Unknown user",

    handle:
      application?.handle ??
      user?.handle ??
      "",

    avatar:
      application?.avatar ??
      user?.avatar ??
      null,

    country:
      application?.country ??
      user?.country ??
      null,

    countryFlag:
      application?.countryFlag ??
      user?.countryFlag ??
      null,

    level: Number(
      application?.level ??
        user?.level ??
        1,
    ),

    status:
      application?.status ??
      "pending",

    createdAt:
      application?.createdAt ??
      null,

    updatedAt:
      application?.updatedAt ??
      null,
  };
}

/* ============================================================================
 * API
 * ========================================================================== */

export const agencyApi = {
  /* --------------------------------------------------------------------------
   * CURRENT USER AGENCY
   * ------------------------------------------------------------------------ */

  async myAgency(): Promise<Agency | null> {
    const response =
      await api.get(
        `${AGENCY_BASE}/me`,
      );

    const data =
      unwrap<any>(response);

    if (!data) {
      return null;
    }

    const agency =
      data?.agency ??
      data;

    if (!agency?.id) {
      return null;
    }

    return {
      ...agency,

      membershipStatus:
        data?.membershipStatus ??
        data?.membership?.status ??
        agency?.membershipStatus ??
        null,
    };
  },

  /* --------------------------------------------------------------------------
   * LIST AGENCIES
   * ------------------------------------------------------------------------ */

  async list(): Promise<Agency[]> {
    const response =
      await api.get(
        AGENCY_BASE,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "agencies",
    );
  },

  /* --------------------------------------------------------------------------
   * GET AGENCY
   * ------------------------------------------------------------------------ */

  async get(
    agencyId: string,
  ): Promise<Agency> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}`,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.agency ??
      data
    );
  },

  /* --------------------------------------------------------------------------
   * REQUEST TO JOIN
   * ------------------------------------------------------------------------ */

  async requestToJoin(
    agencyId: string,
    agencyCode: string,
  ): Promise<Agency> {
    const code =
      agencyCode.trim();

    if (!code) {
      throw new Error(
        "Agency code is required.",
      );
    }

    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/join`,
        {
          code,
        },
      );

    const data =
      unwrap<any>(response);

    const agency =
      data?.agency ??
      (await this.get(agencyId));

    return {
      ...agency,

      membershipStatus:
        data?.membershipStatus ??
        data?.membership?.status ??
        data?.application?.status ??
        "pending",
    };
  },

  /* --------------------------------------------------------------------------
   * JOIN BY CODE
   * ------------------------------------------------------------------------ */

  async joinByCode(code: string): Promise<Agency> {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new Error("Agency code is required.");
    }

    const response = await api.post(`${AGENCY_BASE}/join`, { code: trimmed });
    const data = unwrap<any>(response);

    const agency = data?.agency ?? { id: data?.application?.agencyId, name: "Agency" };
    return {
      ...agency,
      membershipStatus: data?.membershipStatus ?? "pending",
    };
  },

  /* --------------------------------------------------------------------------
   * LEAVE / CANCEL PENDING APPLICATION
   * ------------------------------------------------------------------------ */

  async leave(
    _agencyId?: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/leave`,
    );
  },

  /* --------------------------------------------------------------------------
   * DASHBOARD
   * ------------------------------------------------------------------------ */

  async dashboard(
    agencyId: string,
  ): Promise<AgencyDashboard> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/dashboard`,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.dashboard ??
      data
    );
  },

  /* ==========================================================================
   * APPLICATIONS
   * ======================================================================== */

  async applications(
    agencyId: string,
  ): Promise<AgencyApplication[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/applications`,
      );

    const data =
      unwrap<any>(response);

    const applications =
      getArray(
        data,
        "applications",
      );

    return applications.map(
      normalizeApplication,
    );
  },

  async approveApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/applications/${userId}/approve`,
      );

    const data =
      unwrap<any>(response);

    return normalizeApplication(
      data?.application ??
        data,
    );
  },

  async rejectApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/applications/${userId}/reject`,
      );

    const data =
      unwrap<any>(response);

    return normalizeApplication(
      data?.application ??
        data,
    );
  },

  /* ==========================================================================
   * AGENTS
   * ======================================================================== */

  async agents(
    agencyId: string,
  ): Promise<AgencyAgent[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/agents`,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "agents",
    );
  },

  async addAgent(
    agencyId: string,
    userId: string,
    commissionRate = 0,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/agents`,
      {
        userId,
        commissionRate,
      },
    );
  },

  async suspendAgent(
    agencyId: string,
    agentId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/agents/${agentId}/suspend`,
    );
  },

  async removeAgent(
    agencyId: string,
    agentId: string,
  ): Promise<void> {
    await api.delete(
      `${AGENCY_BASE}/${agencyId}/agents/${agentId}`,
    );
  },

  /* ==========================================================================
   * HOSTS
   * ======================================================================== */

  async hosts(
    agencyId: string,
  ): Promise<AgencyHost[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/hosts`,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "hosts",
    );
  },

  async suspendHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/hosts/${hostId}/suspend`,
    );
  },

  async restoreHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/hosts/${hostId}/restore`,
    );
  },

  async removeHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/hosts/${hostId}/remove`,
    );
  },

  async updateHostCommission(
    agencyId: string,
    hostId: string,
    commissionRate: number,
  ): Promise<void> {
    await api.patch(
      `${AGENCY_BASE}/${agencyId}/hosts/${hostId}`,
      {
        commissionRate,
      },
    );
  },

  /* ==========================================================================
   * HOST -> AGENT
   * ======================================================================== */

  async assignHostAgent(
    agencyId: string,
    hostId: string,
    agentId: string | null,
  ): Promise<void> {
    await api.patch(
      `${AGENCY_BASE}/${agencyId}/hosts/${hostId}/agent`,
      {
        agentId,
      },
    );
  },

  /* ==========================================================================
   * INVITATIONS
   * ======================================================================== */

  async invitations(
    agencyId: string,
  ): Promise<AgencyInvitation[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/invitations`,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "invitations",
    );
  },

  async inviteHost(
    agencyId: string,
    userId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/${agencyId}/invitations`,
      {
        hostId: userId,
      },
    );
  },

  async invite(
    agencyId: string,
    userId: string,
  ): Promise<void> {
    return this.inviteHost(
      agencyId,
      userId,
    );
  },

  async myInvitations(): Promise<
    AgencyInvitation[]
  > {
    const response =
      await api.get(
        `${AGENCY_BASE}/me/invitations`,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "invitations",
    );
  },

  async acceptInvitation(
    invitationId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/invitations/${invitationId}/accept`,
    );
  },

  async rejectInvitation(
    invitationId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/invitations/${invitationId}/reject`,
    );
  },

  async cancelInvitation(
    invitationId: string,
  ): Promise<void> {
    await api.post(
      `${AGENCY_BASE}/invitations/${invitationId}/cancel`,
    );
  },

  /* ==========================================================================
   * TASKS
   * ======================================================================== */

  async tasks(
    agencyId: string,
  ): Promise<AgencyTask[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/tasks`,
      );

    const data =
      unwrap<any>(response);

    const tasks =
      getArray(
        data,
        "tasks",
      );

    return tasks.map(
      (
        task: any,
      ): AgencyTask => ({
        id: String(
          task.id,
        ),

        agencyId: String(
          task.agencyId,
        ),

        title: String(
          task.title ?? "",
        ),

        description:
          task.description ??
          null,

        type:
          task.type as AgencyTaskType,

        targetValue: Number(
          task.targetValue ??
            0,
        ),

        rewardCoins: Number(
          task.rewardCoins ??
            0,
        ),

        rewardDiamonds: Number(
          task.rewardDiamonds ??
            0,
        ),

        startAt: String(
          task.startAt ?? "",
        ),

        endAt:
          task.endAt ??
          null,

        status: String(
          task.status ??
            "active",
        ),

        assignedCount: Number(
          task.assignedCount ??
            0,
        ),

        completedCount: Number(
          task.completedCount ??
            0,
        ),

        createdAt: String(
          task.createdAt ??
            "",
        ),

        assignment:
          task.assignment ??
          null,
      }),
    );
  },

  async createTask(
    agencyId: string,
    payload: {
      title: string;
      description?: string | null;
      type: AgencyTaskType;
      targetValue: number;
      rewardCoins?: number;
      rewardDiamonds?: number;
      startAt?: string;
      endAt?: string | null;
    },
  ): Promise<AgencyTask> {
    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/tasks`,
        payload,
      );

    const data =
      unwrap<any>(response);

    const task =
      data?.task ??
      data;

    return {
      ...task,

      assignment:
        task?.assignment ??
        null,
    };
  },

  async claimTask(
    agencyId: string,
    taskId: string,
  ): Promise<any> {
    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/tasks/${taskId}/claim`,
      );

    return unwrap<any>(
      response,
    );
  },

  /* ==========================================================================
   * PAYOUTS
   * ======================================================================== */

  async payouts(
    agencyId: string,
  ): Promise<Payout[]> {
    const response =
      await api.get(
        `${AGENCY_BASE}/${agencyId}/payouts`,
      );

    const data =
      unwrap<any>(response);

    return getArray(
      data,
      "payouts",
    );
  },

  async requestPayout(
    agencyId: string,
    amount: number,
    note?: string,
  ): Promise<Payout> {
    const response =
      await api.post(
        `${AGENCY_BASE}/${agencyId}/payouts`,
        {
          amount,
          note,
        },
      );

    const data =
      unwrap<any>(response);

    return (
      data?.payout ??
      data
    );
  },

  async updatePayoutStatus(
    payoutId: string,
    status: PayoutStatus,
  ): Promise<Payout> {
    const response =
      await api.post(
        `${AGENCY_BASE}/payouts/${payoutId}/status`,
        {
          status,
        },
      );

    const data =
      unwrap<any>(response);

    return (
      data?.payout ??
      data
    );
  },
};