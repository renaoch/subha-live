import { apiFetch } from "@/lib/api/client";

export interface Agency {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  commissionRate: number;
  monthlyRevenue: number;
  totalHosts: number;
  createdAt: string;
}

export interface AgencyHost {
  agencyId: string;
  hostId: string;
  joinedAt: string | null;
  status: string;
  name?: string;
  handle?: string;
  avatar?: string | null;
}

export interface AgencyApplication {
  id: string;
  agencyId: string;
  userId: string;
  status: string;
  createdAt: string;
}

interface AgenciesResponse {
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
  membership?: AgencyHost | null;
}

interface AgencyApplicationsResponse {
  status: string;
  applications: AgencyApplication[];
}

export const agencyApi = {
  /**
   * Discover all agencies.
   *
   * GET /api/v1/agency
   */
  list() {
    return apiFetch<AgenciesResponse>(
      "/api/v1/agency",
    ).then((response) => response.agencies);
  },

  /**
   * Get the authenticated user's agency.
   *
   * GET /api/v1/agency/me
   */
  me() {
    return apiFetch<MyAgencyResponse>(
      "/api/v1/agency/me",
    );
  },

  /**
   * Get public agency details.
   *
   * GET /api/v1/agency/:id
   */
  get(id: string) {
    return apiFetch<AgencyResponse>(
      `/api/v1/agency/${id}`,
    ).then((response) => response.agency);
  },

  /**
   * Request to join an agency.
   *
   * POST /api/v1/agency/:id/join
   */
  join(id: string) {
    return apiFetch<AgencyResponse>(
      `/api/v1/agency/${id}/join`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Leave current agency.
   *
   * POST /api/v1/agency/leave
   */
  leave() {
    return apiFetch<void>(
      "/api/v1/agency/leave",
      {
        method: "POST",
      },
    );
  },

  /**
   * Get applications for an agency.
   *
   * GET /api/v1/agency/:id/applications
   */
  applications(agencyId: string) {
    return apiFetch<AgencyApplicationsResponse>(
      `/api/v1/agency/${agencyId}/applications`,
    ).then(
      (response) => response.applications,
    );
  },

  /**
   * Approve a user's application.
   *
   * POST /api/v1/agency/:id/applications/:userId/approve
   */
  approveApplication(
    agencyId: string,
    userId: string,
  ) {
    return apiFetch<AgencyResponse>(
      `/api/v1/agency/${agencyId}/applications/${userId}/approve`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Reject a user's application.
   *
   * POST /api/v1/agency/:id/applications/:userId/reject
   */
  rejectApplication(
    agencyId: string,
    userId: string,
  ) {
    return apiFetch<AgencyResponse>(
      `/api/v1/agency/${agencyId}/applications/${userId}/reject`,
      {
        method: "POST",
      },
    );
  },
};