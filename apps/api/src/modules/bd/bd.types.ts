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