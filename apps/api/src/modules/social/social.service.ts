import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database.types";
import { AppError } from "../../errors/app-error";

type UserId =
  Database["public"]["Tables"]["profiles"]["Row"]["id"];
  
// follow a user
export async function followUser(
  followerId: UserId,
  followingId: UserId
) {
  // Prevent self-follow.
  if (followerId === followingId) {
    throw new AppError(
      400,
      "You cannot follow yourself",
      {
        code: "SELF_FOLLOW",
      }
    );
  }

  // Make sure the target user exists.
  const { data: targetUser, error: targetError } =
    await supabase
      .from("profiles")
      .select("id")
      .eq("id", followingId)
      .single();

  if (targetError) {
    if (targetError.code === "PGRST116") {
      throw new AppError(
        404,
        "User not found",
        {
          code: "USER_NOT_FOUND",
        }
      );
    }

    throw targetError;
  }

  if (!targetUser) {
    throw new AppError(
      404,
      "User not found",
      {
        code: "USER_NOT_FOUND",
      }
    );
  }

  // Create the follow relationship.
  const { data, error } = await supabase
    .from("follows")
    .insert({
      follower_id: followerId,
      following_id: followingId,
    })
    .select(`
      follower_id,
      following_id,
      created_at
    `)
    .single();

  if (error) {
    // PostgreSQL unique violation.
    // This means the user is already following this account.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "Already following this user",
        {
          code: "ALREADY_FOLLOWING",
        }
      );
    }

    throw error;
  }

  return data;
}


// unfollow a user
export async function unfollowUser(
  followerId: UserId,
  followingId: UserId
) {
  // if user wants to unfollow itself dont let them.
  if (followerId === followingId) {
    throw new AppError(
      400,
      "You cannot unfollow yourself.",
      {
        code: "SELF_UNFOLLOW",
      }
    );
  }

  const { data, error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .select(`
      follower_id,
      following_id,
      created_at
    `)
    .single();

  if (error) {
    // No follow relationship exists.
    if (error.code === "PGRST116") {
      throw new AppError(
        409,
        "You are not following this user.",
        {
          code: "NOT_FOLLOWING",
        }
      );
    }

    throw error;
  }

  return data;
}