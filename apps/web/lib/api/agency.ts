// File: apps/web/lib/api/agency.ts

import { api } from "./client";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

export type AgencyMembershipStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "left";

export interface Agency {
  id: string;
  name: string;

  /*
   * Private code should not be returned by public endpoints.
   * It remains optional for owner-only responses.
   */
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

  membershipStatus?:
    | AgencyMembershipStatus
    | null;

  createdAt?: string;
  updatedAt?: string;
}

/* ========================================================================== */
/* APPLICATIONS                                                               */
/* ========================================================================== */

export type AgencyApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface AgencyApplication {
  id: string;

  agencyId: string;

  userId: string;

  status: AgencyApplicationStatus;

  createdAt: string;

  updatedAt?: string;

  user?: {
    id: string;
    name: string;
    handle: string;
    avatar?: string | null;
    country?: string | null;
    countryFlag?: string | null;
    level?: number;
  };
}

/* ========================================================================== */
/* HOSTS                                                                      */
/* ========================================================================== */

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

  joinedAt?: string;

  updatedAt?: string;

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
/* DASHBOARD                                                                  */
/* ========================================================================== */

export interface AgencyDashboard {
  totalHosts: number;

  activeHosts: number;

  pendingApplications: number;

  pendingInvitations: number;

  activeTasks: number;

  pendingPayouts: number;

  monthlyRevenue: number;

  totalRevenue: number;
}

/* ========================================================================== */
/* JOIN                                                                       */
/* ========================================================================== */

export interface AgencyJoinApplication {
  agencyId: string;

  status: AgencyApplicationStatus;

  createdAt: string | null;
}

export interface AgencyJoinResponse {
  agency?: Agency;

  application?: AgencyJoinApplication;

  membership?: {
    id?: string;
    status: AgencyMembershipStatus;
  };

  membershipStatus:
    | AgencyMembershipStatus
    | null;
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

  assignment:
    | AgencyTaskAssignment
    | null;
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

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

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

/* ========================================================================== */
/* API                                                                        */
/* ========================================================================== */

export const agencyApi = {
  /* ------------------------------------------------------------------------ */
  /* CURRENT USER                                                             */
  /* ------------------------------------------------------------------------ */

  async myAgency(): Promise<
    Agency | null
  > {
    const response =
      await api.get(
        "/agencies/me",
      );

    const data =
      unwrap<any>(response);

    if (!data) {
      return null;
    }

    if (data.agency) {
      return {
        ...data.agency,

        membershipStatus:
          data.membership?.status ??
          data.membershipStatus ??
          data.agency
            ?.membershipStatus ??
          null,
      };
    }

    return data;
  },

  /* ------------------------------------------------------------------------ */
  /* AGENCY LIST                                                              */
  /* ------------------------------------------------------------------------ */

  async list(): Promise<Agency[]> {
    const response =
      await api.get(
        "/agencies",
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.agencies ?? [];
  },

  /* ------------------------------------------------------------------------ */
  /* AGENCY DETAILS                                                           */
  /* ------------------------------------------------------------------------ */

  async get(
    agencyId: string,
  ): Promise<Agency> {
    const response =
      await api.get(
        `/agencies/${agencyId}`,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.agency ??
      data
    );
  },

  /* ------------------------------------------------------------------------ */
  /* JOIN                                                                     */
  /* ------------------------------------------------------------------------ */

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
        `/agencies/${agencyId}/join`,
        {
          code,
        },
      );

    const data =
      unwrap<any>(response);

    /*
     * The backend creates a PENDING application.
     *
     * It does not mean the user is already
     * an approved agency member.
     */

    const agency =
      data?.agency ??
      (await this.get(
        agencyId,
      ));

    return {
      ...agency,

      membershipStatus:
        data?.membershipStatus ??
        data?.application
          ?.status ??
        "pending",
    };
  },

  /* ------------------------------------------------------------------------ */
  /* LEAVE                                                                    */
  /* ------------------------------------------------------------------------ */

  async leave(
    _agencyId?: string,
  ): Promise<void> {
    await api.post(
      "/agencies/leave",
    );
  },

  /* ------------------------------------------------------------------------ */
  /* DASHBOARD                                                                */
  /* ------------------------------------------------------------------------ */

  async dashboard(
    agencyId: string,
  ): Promise<AgencyDashboard> {
    const response =
      await api.get(
        `/agencies/${agencyId}/dashboard`,
      );

    return unwrap<AgencyDashboard>(
      response,
    );
  },

  /* ======================================================================== */
  /* APPLICATIONS                                                             */
  /* ======================================================================== */

  async applications(
    agencyId: string,
  ): Promise<AgencyApplication[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/applications`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.applications ?? [];
  },

  async approveApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response =
      await api.post(
        `/agencies/${agencyId}/applications/${userId}/approve`,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.application ??
      data
    );
  },

  async rejectApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response =
      await api.post(
        `/agencies/${agencyId}/applications/${userId}/reject`,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.application ??
      data
    );
  },

  /* ======================================================================== */
  /* AGENTS                                                                   */
  /* ======================================================================== */

  async agents(
    agencyId: string,
  ): Promise<AgencyAgent[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/agents`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.agents ?? [];
  },

  async addAgent(
    agencyId: string,
    userId: string,
    commissionRate = 0,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/agents`,
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
      `/agencies/${agencyId}/agents/${agentId}/suspend`,
    );
  },

  async removeAgent(
    agencyId: string,
    agentId: string,
  ): Promise<void> {
    await api.delete(
      `/agencies/${agencyId}/agents/${agentId}`,
    );
  },

  /* ======================================================================== */
  /* HOSTS                                                                    */
  /* ======================================================================== */

  async hosts(
    agencyId: string,
  ): Promise<AgencyHost[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/hosts`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.hosts ?? [];
  },

  async suspendHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/suspend`,
    );
  },

  async restoreHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/restore`,
    );
  },

  async removeHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/remove`,
    );
  },

  async updateHostCommission(
    agencyId: string,
    hostId: string,
    commissionRate: number,
  ): Promise<void> {
    await api.patch(
      `/agencies/${agencyId}/hosts/${hostId}`,
      {
        commissionRate,
      },
    );
  },

  /* ======================================================================== */
  /* INVITATIONS                                                              */
  /* ======================================================================== */

  async invitations(
    agencyId: string,
  ): Promise<AgencyInvitation[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/invitations`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.invitations ?? [];
  },

  async inviteHost(
    agencyId: string,
    userId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/invitations`,
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

  async cancelInvitation(
    invitationId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/invitations/${invitationId}/cancel`,
    );
  },

  /* ======================================================================== */
  /* TASKS                                                                    */
  /* ======================================================================== */

  async tasks(
    agencyId: string,
  ): Promise<AgencyTask[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/tasks`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.tasks ?? [];
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
        `/agencies/${agencyId}/tasks`,
        payload,
      );

    const data =
      unwrap<any>(response);

    return (
      data?.task ??
      data
    );
  },

  async claimTask(
    agencyId: string,
    taskId: string,
  ): Promise<any> {
    const response =
      await api.post(
        `/agencies/${agencyId}/tasks/${taskId}/claim`,
      );

    return unwrap<any>(
      response,
    );
  },

  /* ======================================================================== */
  /* PAYOUTS                                                                  */
  /* ======================================================================== */

  async payouts(
    agencyId: string,
  ): Promise<Payout[]> {
    const response =
      await api.get(
        `/agencies/${agencyId}/payouts`,
      );

    const data =
      unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.payouts ?? [];
  },

  async requestPayout(
    agencyId: string,
    amount: number,
    note?: string,
  ): Promise<Payout> {
    const response =
      await api.post(
        `/agencies/${agencyId}/payouts`,
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
};