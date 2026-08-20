import type { Database } from "../../types/database.types";

export type CpPartnership =
  Database["public"]["Tables"]["cp_partnerships"]["Row"];

export interface CpPartner {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  countryFlag: string | null;
  level: number;
  isVerified: boolean;
}

export interface CpPartnershipResult {
  id: string;
  ringName: string | null;
  cpLevel: number;
  intimacyPoints: number;
  status: string | null;
  anniversaryDate: string | null;
  createdAt: string | null;
  partner: CpPartner;
}

export interface MyCpResult {
  partnership: CpPartnershipResult | null;
}