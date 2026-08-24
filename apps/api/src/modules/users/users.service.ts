import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";
import type {
  PrivateProfile,
  PublicProfile,
} from "./users.types";
import { AppError } from "../../errors/app-error";

type ProfileUpdate =
  Database["public"]["Tables"]["profiles"]["Update"];

type UserId =
  Database["public"]["Tables"]["profiles"]["Row"]["id"];

/**
 * Badge role is derived from the actual agency relationships.
 *
 * Priority:
 *
 * agency owner
 *   ↓
 * host manager
 *   ↓
 * normal profile role
 *
 * Engineer is NOT handled here.
 * Engineer is controlled exclusively by profiles.is_admin.
 */
type AgencyBadgeRole =
  | "agency_owner"
  | "agency_agent"
  | null;

// Private profile fields
// Returned only for the authenticated user's own profile.
const PRIVATE_PROFILE_FIELDS = `
  id,
  public_id,
  name,
  handle,
  avatar,
  bio,
  country,
  country_flag,
  level,
  vip_level,
  svip,
  is_verified,
  coins,
  diamonds,
  followers,
  following,
  created_at,
  gender,
  role,
  is_admin
`;

// Public profile fields
// Safe profile information that can be viewed by other users.
const PUBLIC_PROFILE_FIELDS = `
  id,
  public_id,
  name,
  handle,
  avatar,
  bio,
  country,
  country_flag,
  level,
  vip_level,
  svip,
  is_verified,
  followers,
  following,
  created_at,
  gender,
  role
`;

/**
 * Resolve the user's agency position from the actual database
 * relationships instead of trusting profiles.role.
 *
 * Agency Owner:
 *   agencies.owner_id = profiles.id
 *
 * Host Manager:
 *   agency_agents.user_id = profiles.id
 *   OR
 *   agency_hosts.agent_id = profiles.id
 *
 * This function does not modify the database.
 */
async function resolveAgencyBadgeRole(
  userId: UserId,
): Promise<AgencyBadgeRole> {
  const [
    { data: ownedAgencies, error: ownerError },
    { data: agentRows, error: agentError },
    { data: managedHosts, error: hostManagerError },
  ] = await Promise.all([
    supabase
      .from("agencies")
      .select("id")
      .eq("owner_id", userId)
      .limit(1),

    supabase
      .from("agency_agents")
      .select("id")
      .eq("user_id", userId)
      .limit(1),

    supabase
      .from("agency_hosts")
      .select("agency_id")
      .eq("agent_id", userId)
      .limit(1),
  ]);

  if (ownerError) {
    throw ownerError;
  }

  if (agentError) {
    throw agentError;
  }

  if (hostManagerError) {
    throw hostManagerError;
  }

  /*
   * Owner takes priority.
   *
   * This means if somebody somehow exists in both
   * agencies.owner_id and agency_agents, they are still
   * displayed as Agency Owner.
   */
  if ((ownedAgencies ?? []).length > 0) {
    return "agency_owner";
  }

  /*
   * A user is a Host Manager if:
   *
   * 1. They are registered in agency_agents
   * OR
   * 2. They are assigned as agent_id on agency_hosts.
   */
  if (
    (agentRows ?? []).length > 0 ||
    (managedHosts ?? []).length > 0
  ) {
    return "agency_agent";
  }

  return null;
}

/**
 * Convert the database role into the role exposed by the
 * profile API.
 *
 * We preserve the existing profile role for ordinary users
 * and only override it when the actual agency relationship
 * proves the user is an owner or manager.
 */
async function resolveProfileRole(
  userId: UserId,
  profileRole: string,
): Promise<string> {
  const agencyRole = await resolveAgencyBadgeRole(userId);

  if (agencyRole === "agency_owner") {
    return "agency_owner";
  }

  if (agencyRole === "agency_agent") {
    return "agency_agent";
  }

  return profileRole;
}

// -----------------------------------------------------------------------------
// Get current authenticated user's private profile
// GET /api/v1/users/me
// -----------------------------------------------------------------------------

export async function getCurrentUser(
  userId: UserId,
): Promise<PrivateProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PRIVATE_PROFILE_FIELDS)
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code: "PROFILE_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  const profile = data as any;

  const resolvedRole = await resolveProfileRole(
    userId,
    profile.role,
  );

  const visitorCount = await getVisitorCount(userId);

  return {
    ...profile,
    role: resolvedRole,
    visitor_count: visitorCount,
  } as PrivateProfile;
}

// -----------------------------------------------------------------------------
// Get public user profile
// GET /api/v1/users/:id
// -----------------------------------------------------------------------------

export async function getUserById(
  userId: UserId,
): Promise<PublicProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_FIELDS)
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User not found",
        {
          code: "USER_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  const profile = data as any;

  const resolvedRole = await resolveProfileRole(
    userId,
    profile.role,
  );

  return {
    ...profile,
    role: resolvedRole,
  } as PublicProfile;
}

// -----------------------------------------------------------------------------
// Update current authenticated user's profile
// PATCH /api/v1/users/me
// -----------------------------------------------------------------------------

export async function updateCurrentUser(
  userId: UserId,
  updates: ProfileUpdate,
): Promise<PrivateProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PRIVATE_PROFILE_FIELDS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code: "PROFILE_NOT_FOUND",
        },
      );
    }

    if (error.code === "23505") {
      throw new AppError(
        409,
        "Username or handle is already in use",
        {
          code: "PROFILE_FIELD_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  const profile = data as any;

  const resolvedRole = await resolveProfileRole(
    userId,
    profile.role,
  );

  const visitorCount = await getVisitorCount(userId);

  return {
    ...profile,
    role: resolvedRole,
    visitor_count: visitorCount,
  } as PrivateProfile;
}

// -----------------------------------------------------------------------------
// Profile visits
// -----------------------------------------------------------------------------

/**
 * Total number of times other users have visited this profile.
 */
async function getVisitorCount(
  profileId: UserId,
): Promise<number> {
  const { count, error } = await supabase
    .from("profile_visits")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("profile_id", profileId);

  if (error) {
    console.error(
      "Failed to count profile visits:",
      error,
    );

    return 0;
  }

  return count ?? 0;
}

/**
 * Records that `visitorId` viewed `profileId`'s public profile.
 *
 * Never records:
 * - self visits
 * - anonymous visits
 */
export async function recordProfileVisit(
  visitorId: string | undefined,
  profileId: UserId,
): Promise<void> {
  if (!visitorId || visitorId === profileId) {
    return;
  }

  try {
    const { error } = await supabase
      .from("profile_visits")
      .insert({
        visitor_id: visitorId,
        profile_id: profileId,
      });

    if (error) {
      console.error(
        "Failed to record profile visit:",
        error,
      );
    }
  } catch (err) {
    console.error(
      "Failed to record profile visit:",
      err,
    );
  }
}

// -----------------------------------------------------------------------------
// Followers / Following lists
// -----------------------------------------------------------------------------

export interface FollowListEntry {
  id: string;
  public_id: string;
  name: string | null;
  handle: string | null;
  avatar: string | null;
  is_verified: boolean;
  level: number;
}

const FOLLOW_ENTRY_FIELDS = `
  id,
  public_id,
  name,
  handle,
  avatar,
  is_verified,
  level
`;

/**
 * Users who follow `userId`.
 */
export async function getFollowers(
  userId: UserId,
): Promise<FollowListEntry[]> {
  const { data, error } = await (
    supabase.from("follows" as any) as any
  )
    .select(
      `
        created_at,
        profiles!follows_follower_id_fkey (
          ${FOLLOW_ENTRY_FIELDS}
        )
      `,
    )
    .eq("following_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as FollowListEntry[];
}

/**
 * Users that `userId` follows.
 */
export async function getFollowing(
  userId: UserId,
): Promise<FollowListEntry[]> {
  const { data, error } = await (
    supabase.from("follows" as any) as any
  )
    .select(
      `
        created_at,
        profiles!follows_following_id_fkey (
          ${FOLLOW_ENTRY_FIELDS}
        )
      `,
    )
    .eq("follower_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as FollowListEntry[];
}