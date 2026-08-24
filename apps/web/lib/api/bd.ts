// File: apps/web/lib/api/bd.ts
//
// Client for the "apply to become an Agency Owner" flow.
//
//   - bdApi.me()      -> current user's own application (or null)
//   - bdApi.apply()   -> submit a new application
//   - bdApi.adminList()    -> admin only: list every application
//   - bdApi.adminApprove() -> admin only: approve (creates the agency)
//   - bdApi.adminReject()  -> admin only: reject

import { api } from "./client";

const BD_BASE = "/api/v1/bd";

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type BdApplicationStatus =
  | "pending"
  | "approved"
  | "rejected";

export interface BdApplication {
  id: string;
  fullName: string;
  contactNumber: string;
  agencyExperience: string | null;
  monthlyTargetUsd: number | null;
  status: BdApplicationStatus | null;
  createdAt: string | null;
}

export interface BdApplicant {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  publicId: string | null;
}

export interface BdApplicationAdmin extends BdApplication {
  userId: string;
  applicant: BdApplicant | null;
}

export interface CreateBdApplicationInput {
  fullName: string;
  contactNumber: string;
  agencyExperience?: string;
  monthlyTargetUsd?: number;
}

export interface ApproveBdApplicationResult {
  application: BdApplication;
  agency: {
    id: string;
    name: string;
    code: string;
    ownerId: string;
  };
}

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function unwrap<T>(response: unknown): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response
  ) {
    return (response as { data: T }).data;
  }

  return response as T;
}

/* ============================================================================
 * API
 * ========================================================================== */

export const bdApi = {
  /**
   * The current user's own (most recent) agency-owner application, or null
   * if they've never applied.
   */
  async me(): Promise<BdApplication | null> {
    const response = await api.get(`${BD_BASE}/me`);
    const data = unwrap<any>(response);
    return data?.application ?? null;
  },

  /**
   * Submit a new "become an Agency Owner" application.
   */
  async apply(
    input: CreateBdApplicationInput,
  ): Promise<BdApplication> {
    const response = await api.post(`${BD_BASE}/apply`, input);
    const data = unwrap<any>(response);
    return data?.application ?? data;
  },

  /* ==========================================================================
   * ADMIN
   * ======================================================================== */

  /**
   * Admin only. Lists every agency-owner application, newest first.
   */
  async adminList(): Promise<BdApplicationAdmin[]> {
    const response = await api.get(`${BD_BASE}/applications`);
    const data = unwrap<any>(response);
    return Array.isArray(data?.applications)
      ? data.applications
      : [];
  },

  /**
   * Admin only. Approves an application. On success, a brand new agency is
   * created for the applicant and their profile is tagged "Agency Owner".
   */
  async adminApprove(
    applicationId: string,
  ): Promise<ApproveBdApplicationResult> {
    const response = await api.post(
      `${BD_BASE}/applications/${applicationId}/approve`,
    );
    const data = unwrap<any>(response);
    return {
      application: data?.application,
      agency: data?.agency,
    };
  },

  /**
   * Admin only. Rejects an application.
   */
  async adminReject(
    applicationId: string,
  ): Promise<BdApplication> {
    const response = await api.post(
      `${BD_BASE}/applications/${applicationId}/reject`,
    );
    const data = unwrap<any>(response);
    return data?.application ?? data;
  },
};