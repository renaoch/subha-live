export interface PublicProfile {
  id: string;

  public_id: string;

  name: string | null;

  handle: string | null;

  avatar: string | null;

  bio: string | null;

  country: string | null;

  country_flag: string | null;

  gender: string | null;

  level: number;

  vip_level: number;

  svip: boolean;

  is_verified: boolean;

  followers: number;

  following: number;

  /**
   * "user" | "agency_agent" | "agency_admin" | "agency_owner" | "admin" | "super_admin"
   * Drives the Agency Owner / Host Manager / Engineer profile badges.
   */
  role: string;

  created_at: string;
}

export interface PrivateProfile extends PublicProfile {
  coins: number;

  diamonds: number;

  /** True only for platform admins (site owner / engineers). */
  is_admin: boolean;

  /** Total number of times other users have visited this profile. */
  visitor_count: number;
}

export interface PrivateProfileResponse {
  status: "ok";

  user: PrivateProfile;
}

export interface PublicProfileResponse {
  status: "ok";

  user: PublicProfile;
}