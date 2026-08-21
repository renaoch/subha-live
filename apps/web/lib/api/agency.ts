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
   * Private agency code should NOT normally be returned
   * by public agency endpoints.
   *
   * Kept optional only for places where the backend may
   * explicitly return it to the authorized owner.
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

export interface AgencyApplication {
  id: string;

  agencyId: string;

  userId: string;

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled";

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

export interface AgencyHost {
  id: string;

  agencyId: string;

  userId: string;

  status:
    | "pending"
    | "approved"
    | "suspended"
    | "removed"
    | "left";

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
/* DASHBOARD                                                                  */
/* ========================================================================== */

export interface AgencyDashboard {
  totalHosts: number;

  activeHosts: number;

  pendingApplications: number;

  pendingInvitations?: number;

  activeTasks: number;

  pendingPayouts: number;

  monthlyRevenue: number;

  totalRevenue: number;
}

/* ========================================================================== */
/* JOIN RESPONSE                                                              */
/* ========================================================================== */

export interface AgencyJoinResponse {
  agency?: Agency;

  membership?: {
    id?: string;

    status: AgencyMembershipStatus;
  };

  /*
   * Current backend returns the application object
   * rather than an `agency + membership` object.
   *
   * Support both shapes.
   */
  application?: {
    agencyId: string;

    status:
      | "pending"
      | "approved"
      | "rejected"
      | "cancelled";

    createdAt: string | null;
  };

  membershipStatus?:
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
/* RESPONSE NORMALIZATION                                                     */
/* ========================================================================== */

function unwrap<T>(
  response: any,
): T {
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
  /* ------------------------------------------------------------------------ */
  /* CURRENT USER AGENCY                                                      */
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
            .membershipStatus ??
          null,
      };
    }

    return data;
  },

  /* ------------------------------------------------------------------------ */
  /* DISCOVER AGENCIES                                                        */
  /* ------------------------------------------------------------------------ */

  async list(): Promise<
    Agency[]
  > {
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
  /* GET AGENCY                                                               */
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

    return data?.agency ?? data;
  },

  /* ------------------------------------------------------------------------ */
  /* REQUEST TO JOIN                                                          */
  /* ------------------------------------------------------------------------ */

  async requestToJoin(
    agencyId: string,
    agencyCode: string,
  ): Promise<Agency> {
    if (!agencyCode.trim()) {
      throw new Error(
        "Agency code is required.",
      );
    }

    const response =
      await api.post(
        `/agencies/${agencyId}/join`,
        {
          code:
            agencyCode.trim(),
        },
      );

    const data =
      unwrap<any>(response);

    /*
     * Current backend:
     *
     * {
     *   status: "ok",
     *   application: {
     *     agencyId,
     *     status: "pending",
     *     createdAt
     *   },
     *   membershipStatus: "pending"
     * }
     *
     * Older/alternate backend:
     *
     * {
     *   agency,
     *   membership
     * }
     */

    if (data?.agency) {
      return {
        ...data.agency,

        membershipStatus:
          data.membership
            ?.status ??
          data.membershipStatus ??
          "pending",
      };
    }

    /*
     * If the backend only returns the application,
     * fetch the agency after successfully creating
     * the pending request.
     */
    const agency =
      await this.get(
        agencyId,
      );

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
  /* LEAVE / CANCEL REQUEST                                                   */
  /* ------------------------------------------------------------------------ */

  async leave(
    _agencyId?: string,
  ): Promise<void> {
    /*
     * Current backend route:
     *
     * POST /agencies/leave
     */
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

  /* ------------------------------------------------------------------------ */
  /* APPLICATIONS                                                             */
  /* ------------------------------------------------------------------------ */

  async applications(
    agencyId: string,
  ): Promise<
    AgencyApplication[]
  > {
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

  /* ------------------------------------------------------------------------ */
  /* APPROVE APPLICATION                                                      */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* REJECT APPLICATION                                                       */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* HOSTS                                                                    */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* SUSPEND HOST                                                             */
  /* ------------------------------------------------------------------------ */

  async suspendHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/suspend`,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* RESTORE HOST                                                             */
  /* ------------------------------------------------------------------------ */

  async restoreHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/restore`,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* REMOVE HOST                                                              */
  /* ------------------------------------------------------------------------ */

  async removeHost(
    agencyId: string,
    hostId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/${agencyId}/hosts/${hostId}/remove`,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* UPDATE HOST COMMISSION                                                   */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* INVITATIONS                                                              */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* SEND INVITATION                                                          */
  /* ------------------------------------------------------------------------ */

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

  /*
   * Backwards-compatible alias.
   */
  async invite(
    agencyId: string,
    userId: string,
  ): Promise<void> {
    return this.inviteHost(
      agencyId,
      userId,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* CANCEL INVITATION                                                        */
  /* ------------------------------------------------------------------------ */

  async cancelInvitation(
    agencyId: string,
    invitationId: string,
  ): Promise<void> {
    await api.post(
      `/agencies/invitations/${invitationId}/cancel`,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* TASKS                                                                    */
  /* ------------------------------------------------------------------------ */

  async tasks(
    agencyId: string,
  ) {
    const response =
      await api.get(
        `/agencies/${agencyId}/tasks`,
      );

    return unwrap<any>(
      response,
    );
  },

  /* ------------------------------------------------------------------------ */
  /* PAYOUTS                                                                  */
  /* ------------------------------------------------------------------------ */

  async payouts(
    agencyId: string,
  ) {
    const response =
      await api.get(
        `/agencies/${agencyId}/payouts`,
      );

    return unwrap<any>(
      response,
    );
  },
};