import { supabase } from "../../lib/supabase";
import { getOrSetCache, cacheDel } from "../../lib/redis";
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
 * host
 *   ↓
 * normal profile role
 *
 * Engineer is NOT handled here.
 * Engineer is controlled exclusively by profiles.is_admin.
 */
type AgencyBadgeRole =
  | "agency_owner"
  | "agency_agent"
  | "agency_host"
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
const PROFILE_CACHE_TTL_SECONDS = 20;
const profileCacheKey = (userId: UserId) => `profile:me:${userId}`;
// Public profile fields
// Safe profile information that can be viewed by other users.

const STORE_CACHE_TTL_SECONDS = 300; // catalog rarely changes
const INVENTORY_CACHE_TTL_SECONDS = 20;
const inventoryCacheKey = (userId: string) => `inventory:${userId}`;
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
 * Host:
 *   agency_hosts.host_id = profiles.id
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
    { data: hostRows, error: hostError },
  ] = await Promise.all([
    // -------------------------------------------------------------
    // Agency Owner
    // -------------------------------------------------------------
    supabase
      .from("agencies")
      .select("id")
      .eq("owner_id", userId)
      .limit(1),

    // -------------------------------------------------------------
    // Host Manager / Agency Agent
    // -------------------------------------------------------------
    supabase
      .from("agency_agents")
      .select("id")
      .eq("user_id", userId)
      .limit(1),

    // -------------------------------------------------------------
    // Host Manager assigned to hosts
    // -------------------------------------------------------------
    supabase
      .from("agency_hosts")
      .select("agency_id")
      .eq("agent_id", userId)
      .limit(1),

    // -------------------------------------------------------------
    // Actual Host
    // -------------------------------------------------------------
    supabase
      .from("agency_hosts")
      .select("agency_id")
      .eq("host_id", userId)
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

  if (hostError) {
    throw hostError;
  }

  // Owner has the highest agency priority.
  if ((ownedAgencies ?? []).length > 0) {
    return "agency_owner";
  }

  // Agency manager / agent.
  if (
    (agentRows ?? []).length > 0 ||
    (managedHosts ?? []).length > 0
  ) {
    return "agency_agent";
  }

  // Actual host.
  if ((hostRows ?? []).length > 0) {
    return "agency_host";
  }

  return null;
}

/**
 * Convert the database role into the role exposed by the
 * profile API.
 *
 * Agency relationships are the source of truth for agency roles.
 */
async function resolveProfileRole(
  userId: UserId,
  profileRole: string,
): Promise<string> {
  const agencyRole =
    await resolveAgencyBadgeRole(userId);

  if (agencyRole === "agency_owner") {
    return "agency_owner";
  }

  if (agencyRole === "agency_agent") {
    return "agency_agent";
  }

  if (agencyRole === "agency_host") {
    return "agency_host";
  }

  return profileRole;
}

/**
 * Count mutual follows.
 *
 * A friend exists when:
 *
 *   user A follows user B
 *   AND
 *   user B follows user A
 *
 * We do NOT store friend_count in profiles.
 * It is derived from the follows relationship.
 */
async function getFriendCount(
  userId: UserId,
): Promise<number> {
  const {
    data: followingRows,
    error: followingError,
  } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (followingError) {
    console.error(
      "Failed to get following users for friend count:",
      followingError,
    );

    return 0;
  }

  if (
    !followingRows ||
    followingRows.length === 0
  ) {
    return 0;
  }

  const followingIds: string[] =
    followingRows.map(
      (row: {
        following_id: string;
      }) => row.following_id,
    );

  const {
    data: mutualRows,
    error: mutualError,
  } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId)
    .in(
      "follower_id",
      followingIds,
    );

  if (mutualError) {
    console.error(
      "Failed to get mutual follows:",
      mutualError,
    );

    return 0;
  }

  return mutualRows?.length ?? 0;
}
// -----------------------------------------------------------------------------
// Get current authenticated user's private profile
// GET /api/v1/users/me
// -----------------------------------------------------------------------------

export async function getCurrentUser(
  userId: UserId,
): Promise<PrivateProfile> {
  return getOrSetCache(
    profileCacheKey(userId),
    PROFILE_CACHE_TTL_SECONDS,
    async () => {
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

      const [
        resolvedRole,
        visitorCount,
        friendCount,
      ] = await Promise.all([
        resolveProfileRole(
          userId,
          profile.role,
        ),

        getVisitorCount(userId),

        getFriendCount(userId),
      ]);

      return {
        ...profile,
        role: resolvedRole,
        visitor_count: visitorCount,
        friend_count: friendCount,
      } as PrivateProfile;
    },
  );
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

  const resolvedRole =
    await resolveProfileRole(
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

  const [
    resolvedRole,
    visitorCount,
    friendCount,
  ] = await Promise.all([
    resolveProfileRole(
      userId,
      profile.role,
    ),

    getVisitorCount(userId),

    getFriendCount(userId),
  ]);

  const result = {
    ...profile,
    role: resolvedRole,
    visitor_count: visitorCount,
    friend_count: friendCount,
  } as PrivateProfile;

  await cacheDel(profileCacheKey(userId));

  return result;
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
  if (
    !visitorId ||
    visitorId === profileId
  ) {
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
    .map(
      (row: any) => row.profiles,
    )
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
    .map(
      (row: any) => row.profiles,
    )
    .filter(Boolean) as FollowListEntry[];
}