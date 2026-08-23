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
  gender
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
  gender
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

  return data as PrivateProfile;
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

  return data as PrivateProfile;
}