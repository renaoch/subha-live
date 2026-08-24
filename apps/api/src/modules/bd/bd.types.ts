import type { Database } from "../../types/database.types";

export type BdApplication =
  Database["public"]["Tables"]["bd_applications"]["Row"];

export interface BdApplicationResult {
  id: string;
  fullName: string;
  contactNumber: string;
  agencyExperience: string | null;
  monthlyTargetUsd: number | null;
  status: string | null;
  createdAt: string | null;
}

export interface BdOverview {
  application: BdApplicationResult | null;
}

/* ========================================================================== */
/* ADMIN                                                                      */
/* ========================================================================== */

export interface BdApplicant {
  id: string;
  name: string | null;
  handle: string | null;
  avatar: string | null;
  publicId: string | null;
}

export interface BdApplicationAdminResult extends BdApplicationResult {
  userId: string;
  applicant: BdApplicant | null;
}

export interface ApproveBdApplicationResult {
  application: BdApplicationResult;
  agency: {
    id: string;
    name: string;
    code: string;
    ownerId: string;
  };
}