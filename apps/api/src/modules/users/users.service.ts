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

// -----------------------------------------------------------------------------
// Get current authenticated user's private profile
// GET /api/v1/users/me
// -----------------------------------------------------------------------------

export async function getCurrentUser(
  userId: UserId,
): Promise<PrivateProfile> {
  const profileStart = performance.now();

  const { data, error } = await supabase
    .from("profiles")
    .select(PRIVATE_PROFILE_FIELDS)
    .eq("id", userId)
    .single();

  console.log(
    `profiles private query: ${(performance.now() - profileStart).toFixed(2)}ms`,
  );

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

  const visitorCount = await getVisitorCount(userId);

  return {
    ...(data as any),
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
  const profileStart = performance.now();

  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_FIELDS)
    .eq("id", userId)
    .single();

  console.log(
    `profiles public query: ${(performance.now() - profileStart).toFixed(2)}ms`,
  );

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

  return data as PublicProfile;
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

  const visitorCount = await getVisitorCount(userId);

  return {
    ...(data as any),
    visitor_count: visitorCount,
  } as PrivateProfile;
}

// -----------------------------------------------------------------------------
// Profile visits
// -----------------------------------------------------------------------------

/**
 * Total number of times other users have visited this profile.
 * Used to populate PrivateProfile.visitor_count.
 *
 * Always resolves to a number (0 when there are no visits, or if the
 * count query fails) — never null/undefined — so the frontend never has
 * to guard against a missing visitor count.
 */
async function getVisitorCount(
  profileId: UserId,
): Promise<number> {
  const { count, error } = await supabase
    .from("profile_visits")
    .select("id", { count: "exact", head: true })
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
 * - Never records a self-visit.
 * - Never records an anonymous (unauthenticated) visit, since
 *   profile_visits.visitor_id has no value to store in that case.
 * - Never throws — this is called fire-and-forget from the controller
 *   and must not affect the response to the caller.
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
 * Users who follow `userId` (i.e. rows in `follows` where
 * following_id = userId), newest first.
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
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as FollowListEntry[];
}

/**
 * Users that `userId` follows (i.e. rows in `follows` where
 * follower_id = userId), newest first.
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
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row: any) => row.profiles)
    .filter(Boolean) as FollowListEntry[];
}