import { api } from "./client";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

export type AgencyMembershipStatus =
  | "pending"
  | "approved"
  | "rejected"
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

  createdAt?: string;
  updatedAt?: string;
}

export interface AgencyApplication {
  id: string;
  agencyId: string;
  userId: string;

  status:
    | "pending"
    | "approved"
    | "rejected";

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

export interface AgencyHost {
  id: string;

  agencyId: string;
  userId: string;

  status:
    | "pending"
    | "approved"
    | "suspended"
    | "removed";

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

export interface AgencyDashboard {
  totalHosts: number;
  activeHosts: number;

  pendingApplications: number;

  activeTasks: number;

  pendingPayouts: number;

  monthlyRevenue: number;
  totalRevenue: number;
}

export interface AgencyJoinResponse {
  agency: Agency;
  membership: {
    id: string;
    status: AgencyMembershipStatus;
  };
}

/* ========================================================================== */
/* RESPONSE NORMALIZATION                                                     */
/* ========================================================================== */

/**
 * Your API may return either:
 *
 * { data: ... }
 *
 * or:
 *
 * { ... }
 *
 * depending on the route.
 *
 * This keeps the frontend API layer tolerant of both.
 */

function unwrap<T>(response: any): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response
  ) {
    return response.data as T;
  }

  return response as T;
}

/* ========================================================================== */
/* AGENCY API                                                                 */
/* ========================================================================== */

export const agencyApi = {
  /**
   * ------------------------------------------------------------------------
   * GET CURRENT USER'S AGENCY
   * ------------------------------------------------------------------------
   *
   * Returns:
   *
   * null
   * OR
   * agency with membershipStatus = pending
   * OR
   * agency with membershipStatus = approved
   */
  async myAgency(): Promise<Agency | null> {
    const response = await api.get(
      "/agencies/me",
    );

    const data = unwrap<any>(response);

    if (!data) {
      return null;
    }

    /*
     * Some APIs return:
     *
     * {
     *   agency: {...},
     *   membership: {...}
     * }
     *
     * Convert that into the object the UI expects.
     */

    if (data.agency) {
      return {
        ...data.agency,
        membershipStatus:
          data.membership?.status ??
          data.agency.membershipStatus ??
          null,
      };
    }

    return data;
  },

  /**
   * ------------------------------------------------------------------------
   * DISCOVER AGENCIES
   * ------------------------------------------------------------------------
   */

  async list(): Promise<Agency[]> {
    const response = await api.get(
      "/agencies",
    );

    const data = unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.agencies ?? [];
  },

  /**
   * ------------------------------------------------------------------------
   * REQUEST TO JOIN
   * ------------------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * This does NOT immediately approve the user.
   *
   * Backend should:
   *
   * 1. Validate agency exists
   * 2. Validate private agency code
   * 3. Check duplicate membership
   * 4. Create membership with status = pending
   * 5. Return agency + membership
   */

  async requestToJoin(
    agencyId: string,
    agencyCode: string,
  ): Promise<Agency> {
    if (!agencyCode.trim()) {
      throw new Error(
        "Agency code is required.",
      );
    }

    const response = await api.post(
      `/agencies/${agencyId}/join`,
      {
        code: agencyCode.trim(),
      },
    );

    const data =
      unwrap<AgencyJoinResponse>(response);

    return {
      ...data.agency,
      membershipStatus:
        data.membership?.status ?? "pending",
    };
  },

  /**
   * ------------------------------------------------------------------------
   * CANCEL PENDING REQUEST / LEAVE AGENCY
   * ------------------------------------------------------------------------
   */

  async leave(
    agencyId: string,
  ): Promise<void> {
    await api.delete(
      `/agencies/${agencyId}/membership`,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * AGENCY DASHBOARD
   * ------------------------------------------------------------------------
   */

  async dashboard(
    agencyId: string,
  ): Promise<AgencyDashboard> {
    const response = await api.get(
      `/agencies/${agencyId}/dashboard`,
    );

    return unwrap<AgencyDashboard>(
      response,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * APPLICATIONS
   * ------------------------------------------------------------------------
   */

  async applications(
    agencyId: string,
  ): Promise<AgencyApplication[]> {
    const response = await api.get(
      `/agencies/${agencyId}/applications`,
    );

    const data = unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.applications ?? [];
  },

  /**
   * ------------------------------------------------------------------------
   * APPROVE APPLICATION
   * ------------------------------------------------------------------------
   */

  async approveApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response = await api.post(
      `/agencies/${agencyId}/applications/${userId}/approve`,
    );

    return unwrap<AgencyApplication>(
      response,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * REJECT APPLICATION
   * ------------------------------------------------------------------------
   */

  async rejectApplication(
    agencyId: string,
    userId: string,
  ): Promise<AgencyApplication> {
    const response = await api.post(
      `/agencies/${agencyId}/applications/${userId}/reject`,
    );

    return unwrap<AgencyApplication>(
      response,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * HOSTS
   * ------------------------------------------------------------------------
   */

  async hosts(
    agencyId: string,
  ): Promise<AgencyHost[]> {
    const response = await api.get(
      `/agencies/${agencyId}/hosts`,
    );

    const data = unwrap<any>(response);

    if (Array.isArray(data)) {
      return data;
    }

    return data?.hosts ?? [];
  },

  /**
   * ------------------------------------------------------------------------
   * SUSPEND HOST
   * ------------------------------------------------------------------------
   */

  async suspendHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.patch(
      `/agencies/${agencyId}/hosts/${hostId}/suspend`,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * RESTORE HOST
   * ------------------------------------------------------------------------
   */

  async restoreHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.patch(
      `/agencies/${agencyId}/hosts/${hostId}/restore`,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * REMOVE HOST
   * ------------------------------------------------------------------------
   *
   * This should NOT delete the user.
   *
   * It only removes the user's membership
   * from the agency.
   */

  async removeHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.delete(
      `/agencies/${agencyId}/hosts/${hostId}`,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * UPDATE HOST COMMISSION
   * ------------------------------------------------------------------------
   */

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

  /**
   * ------------------------------------------------------------------------
   * INVITATIONS
   * ------------------------------------------------------------------------
   */

  async invitations(
    agencyId: string,
  ) {
    const response = await api.get(
      `/agencies/${agencyId}/invitations`,
    );

    return unwrap<any>(response);
  },

  /**
   * ------------------------------------------------------------------------
   * SEND INVITATION
   * ------------------------------------------------------------------------
   */

  async invite(
    agencyId: string,
    userId: string,
  ) {
    const response = await api.post(
      `/agencies/${agencyId}/invitations`,
      {
        userId,
      },
    );

    return unwrap<any>(response);
  },

  /**
   * ------------------------------------------------------------------------
   * CANCEL INVITATION
   * ------------------------------------------------------------------------
   */

  async cancelInvitation(
    agencyId: string,
    invitationId: string,
  ) {
    await api.delete(
      `/agencies/${agencyId}/invitations/${invitationId}`,
    );
  },

  /**
   * ------------------------------------------------------------------------
   * TASKS
   * ------------------------------------------------------------------------
   */

  async tasks(
    agencyId: string,
  ) {
    const response = await api.get(
      `/agencies/${agencyId}/tasks`,
    );

    return unwrap<any>(response);
  },

  /**
   * ------------------------------------------------------------------------
   * PAYOUTS
   * ------------------------------------------------------------------------
   */

  async payouts(
    agencyId: string,
  ) {
    const response = await api.get(
      `/agencies/${agencyId}/payouts`,
    );

    return unwrap<any>(response);
  },
};