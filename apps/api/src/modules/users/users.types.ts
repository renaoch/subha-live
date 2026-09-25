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
   * Number of mutual follows (A follows B AND B follows A). Computed live
   * from the `follows` table, same as `followers`/`following` — never
   * trusted from a stored counter, so it can't drift out of sync with
   * what the followers/following lists actually contain.
   */
  friend_count: number;

  /**
   * Resolved profile role.
   *
   * "user"
   * "agency_agent"
   * "agency_admin"
   * "agency_owner"
   * "agency_host"
   * "admin"
   * "super_admin"
   *
   * Agency roles are resolved from the actual agency
   * relationships in users.service.ts.
   */
  role: string;

  created_at: string;
}

export interface PrivateProfile extends PublicProfile {
  coins: number;

  diamonds: number;

  /**
   * True only for platform admins / engineers.
   *
   * This is separate from agency roles.
   */
  is_admin: boolean;

  /**
   * Total number of times other users have visited
   * this profile.
   */
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