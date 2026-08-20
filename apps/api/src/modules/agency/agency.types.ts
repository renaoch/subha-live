import type { Database } from "../../types/database.types";

export type Agency =
  Database["public"]["Tables"]["agencies"]["Row"];

export type AgencyHost =
  Database["public"]["Tables"]["agency_hosts"]["Row"];

export interface AgencySummary {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  commissionRate: number;
  monthlyRevenue: number;
  totalHosts: number;
  createdAt: string | null;
}

export interface AgencyMember {
  userId: string;
  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  countryFlag: string | null;
  level: number;
  status: string | null;
  joinedAt: string | null;
}

export interface MyAgencyResult {
  agency: AgencySummary | null;
  membershipStatus: string | null;
}

export interface AgencyDetailsResult {
  agency: AgencySummary;
  members: AgencyMember[];
}

export interface AgencyApplicationResult {
  agencyId: string;
  status: string | null;
  createdAt: string | null;
}

export interface AgencyListResult {
  agencies: AgencySummary[];
}