import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";
import { AppError } from "../../errors/app-error";

type ProfileUpdate =
  Database["public"]["Tables"]["profiles"]["Update"];

type UserId =
  Database["public"]["Tables"]["profiles"]["Row"]["id"];

// current user : application level
export async function getCurrentUser(userId: UserId) {
  const profileStart = performance.now();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
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
      is_admin,
      role
    `)
    .eq("id", userId)
    .single();

  console.log(
    `profiles query: ${(performance.now() - profileStart).toFixed(2)}ms`
  );

  if (error) {
    // User authenticated successfully but their application
    // profile does not exist.
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code: "PROFILE_NOT_FOUND",
        }
      );
    }

    // Unexpected database/infrastructure error.
    throw error;
  }

  return data;
}

//user profile details : only public view
export async function getUserById(userId: UserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
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
    `)
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User not found",
        {
          code: "USER_NOT_FOUND",
        }
      );
    }

    throw error;
  }

  return data;
}

//update current user only - not sensitive imfo tho
export async function updateCurrentUser(
  userId: UserId,
  updates: ProfileUpdate
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(`
      id,
      name,
      handle,
      avatar,
      bio,
      country,
      country_flag,
      created_at,
      gender
    `)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code: "PROFILE_NOT_FOUND",
        }
      );
    }

    // Example: handle/username unique constraint.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "Username or handle is already in use",
        {
          code: "PROFILE_FIELD_ALREADY_EXISTS",
        }
      );
    }

    throw error;
  }

  return data;
}

