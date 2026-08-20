import type { Database } from "../../types/database.types";

export type Family =
  Database["public"]["Tables"]["families"]["Row"];

export type FamilyMember =
  Database["public"]["Tables"]["family_members"]["Row"];

export interface FamilyMemberResult {
  userId: string;
  name: string;
  handle: string;
  avatar: string | null;
  role: string;
  joinedAt: string | null;
}

export interface FamilyResult {
  id: string;
  name: string;
  badgeText: string;
  logoUrl: string | null;
  leaderId: string | null;
  level: number;
  exp: number;
  announcement: string | null;
  maxMembers: number;
  createdAt: string | null;
  memberCount: number;
  members: FamilyMemberResult[];
}

export interface MyFamilyResult {
  families: FamilyResult[];
}