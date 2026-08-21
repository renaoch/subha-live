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
  members: AgencyMember[];
}

interface AgencyActionResponse {
  status: string;
  agency?: Agency;
}

export const agencyApi = {
  /**
   * GET /api/v1/agency
   *
   * Public agency discovery.
   */
  list() {
    return apiFetch<AgencyListResponse>(
      "/api/v1/agency",
    ).then((response) => response.agencies);
  },

  /**
   * GET /api/v1/agency/:id
   *
   * Public agency details.
   */
  get(id: string) {
    return apiFetch<AgencyResponse>(
      `/api/v1/agency/${id}`,
    ).then((response) => response.agency);
  },

  /**
   * GET /api/v1/agency/me
   *
   * Authenticated user's agency.
   */
  me() {
    return apiFetch<MyAgencyResponse>(
      "/api/v1/agency/me",
    );
  },

  /**
   * POST /api/v1/agency/:id/join
   *
   * Request to join an agency.
   */
  join(id: string) {
    return apiFetch<AgencyActionResponse>(
      `/api/v1/agency/${id}/join`,
      {
        method: "POST",
      },
    );
  },

  /**
   * POST /api/v1/agency/leave
   *
   * Leave current agency.
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
   * GET /api/v1/agency/:id/applications
   *
   * Agency owner/admin application list.
   */
  applications(id: string) {
    return apiFetch<{
      status: string;
      applications: unknown[];
    }>(
      `/api/v1/agency/${id}/applications`,
    ).then(
      (response) =>
        response.applications,
    );
  },

  /**
   * POST /api/v1/agency/:id/applications/:userId/approve
   */
  approveApplication(
    agencyId: string,
    userId: string,
  ) {
    return apiFetch<AgencyActionResponse>(
      `/api/v1/agency/${agencyId}/applications/${userId}/approve`,
      {
        method: "POST",
      },
    );
  },

  /**
   * POST /api/v1/agency/:id/applications/:userId/reject
   */
  rejectApplication(
    agencyId: string,
    userId: string,
  ) {
    return apiFetch<AgencyActionResponse>(
      `/api/v1/agency/${agencyId}/applications/${userId}/reject`,
      {
        method: "POST",
      },
    );
  },
};