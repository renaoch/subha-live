import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";

type ProfileUpdate =
  Database["public"]["Tables"]["profiles"]["Update"];
type UserId =
  Database["public"]["Tables"]["profiles"]["Row"]["id"];

//get current application layer user details from supabase profiles table
export async function getCurrentUser(userId: UserId) {
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

  if (error) {
    throw error;
  }

  return data;
}
//get user by id: 
//TODO: LATER I NEED TO MAKE A NEW SCHEMA WHERE THE VIEW PROFILE ARE PUBLIC AND OTEHER INFO IS PROVATE OFR NOW THIS IS GOOD
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
    throw error;
  }

  return data;
}

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
    throw error;
  }

  return data;
}