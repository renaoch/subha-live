import { supabase } from "../../lib/supabase";
import { encodeCursor, decodeCursor } from "../../lib/cursor";
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

  // Prevent following when either user has blocked the other.
  const { data: blockRelationship, error: blockError } =
    await supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(
        `and(blocker_id.eq.${followerId},blocked_id.eq.${followingId}),and(blocker_id.eq.${followingId},blocked_id.eq.${followerId})`
      )
      .maybeSingle();

  if (blockError) {
    throw blockError;
  }

  if (blockRelationship) {
    throw new AppError(
      403,
      "You cannot follow this user",
      {
        code: "FOLLOW_BLOCKED",
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
  // Prevent self-unfollow.
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

// get followers of a user
export async function getFollowers(
  userId: UserId,
  limit: number,
  cursor?: string
) {
  const decodedCursor = cursor
    ? decodeCursor(cursor)
    : null;

  if (cursor && !decodedCursor) {
    throw new AppError(
      400,
      "Invalid pagination cursor",
      {
        code: "INVALID_CURSOR",
      }
    );
  }

  let query = supabase
    .from("follows")
    .select(`
      follower_id,
      created_at,
      follower:profiles!follows_follower_id_fkey (
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
        is_verified
      )
    `)
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .order("follower_id", { ascending: false })
    .limit(limit + 1);

  if (decodedCursor) {
    query = query.or(
      `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},follower_id.lt.${decodedCursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = data.length > limit;

  const followers = hasMore
    ? data.slice(0, limit)
    : data;

  const lastFollower =
    followers.length > 0
      ? followers[followers.length - 1]
      : null;

  const nextCursor =
    hasMore && lastFollower
      ? encodeCursor({
          created_at: lastFollower.created_at,
          id: lastFollower.follower_id,
        })
      : null;

  return {
    followers,
    next_cursor: nextCursor,
  };
}

// get users that a user is following
export async function getFollowing(
  userId: UserId,
  limit: number,
  cursor?: string
) {
  const decodedCursor = cursor
    ? decodeCursor(cursor)
    : null;

  if (cursor && !decodedCursor) {
    throw new AppError(
      400,
      "Invalid pagination cursor",
      {
        code: "INVALID_CURSOR",
      }
    );
  }

  let query = supabase
    .from("follows")
    .select(`
      following_id,
      created_at,
      following:profiles!follows_following_id_fkey (
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
        is_verified
      )
    `)
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .order("following_id", { ascending: false })
    .limit(limit + 1);

  if (decodedCursor) {
    query = query.or(
      `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},following_id.lt.${decodedCursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = data.length > limit;

  const following = hasMore
    ? data.slice(0, limit)
    : data;

  const lastFollowing =
    following.length > 0
      ? following[following.length - 1]
      : null;

  const nextCursor =
    hasMore && lastFollowing
      ? encodeCursor({
          created_at: lastFollowing.created_at,
          id: lastFollowing.following_id,
        })
      : null;

  return {
    following,
    next_cursor: nextCursor,
  };
}

// get follow status between two users
export async function getFollowStatus(
  followerId: UserId,
  followingId: UserId
) {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    following: !!data,
  };
}

// block a user
export async function blockUser(
  blockerId: UserId,
  blockedId: UserId
) {
  // Prevent blocking yourself.
  if (blockerId === blockedId) {
    throw new AppError(
      400,
      "You cannot block yourself",
      {
        code: "SELF_BLOCK",
      }
    );
  }

  // Make sure the target user exists.
  const { data: targetUser, error: targetError } =
    await supabase
      .from("profiles")
      .select("id")
      .eq("id", blockedId)
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

  // Create the block relationship.
  const { data, error } = await supabase
    .from("blocks")
    .insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    })
    .select(`
      blocker_id,
      blocked_id,
      created_at
    `)
    .single();

  if (error) {
    // PostgreSQL unique violation.
    // This means the user is already blocked.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "You have already blocked this user",
        {
          code: "ALREADY_BLOCKED",
        }
      );
    }

    throw error;
  }

  // Remove follow relationship from blocker -> blocked.
  const { error: removeOutgoingFollowError } =
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", blockerId)
      .eq("following_id", blockedId);

  if (removeOutgoingFollowError) {
    throw removeOutgoingFollowError;
  }

  // Remove follow relationship from blocked -> blocker.
  const { error: removeIncomingFollowError } =
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", blockedId)
      .eq("following_id", blockerId);

  if (removeIncomingFollowError) {
    throw removeIncomingFollowError;
  }

  return data;
}

// unblock a user
export async function unblockUser(
  blockerId: UserId,
  blockedId: UserId
) {
  // Prevent trying to unblock yourself.
  if (blockerId === blockedId) {
    throw new AppError(
      400,
      "You cannot unblock yourself",
      {
        code: "SELF_UNBLOCK",
      }
    );
  }

  const { data, error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .select(`
      blocker_id,
      blocked_id,
      created_at
    `)
    .single();

  if (error) {
    // No block relationship exists.
    if (error.code === "PGRST116") {
      throw new AppError(
        409,
        "You have not blocked this user",
        {
          code: "NOT_BLOCKED",
        }
      );
    }

    throw error;
  }

  return data;
}

// get block status between two users
export async function getBlockStatus(
  blockerId: UserId,
  blockedId: UserId
) {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    blocked: !!data,
  };
}

// mute a user
export async function muteUser(
  muterId: UserId,
  mutedId: UserId
) {
  // Prevent muting yourself.
  if (muterId === mutedId) {
    throw new AppError(
      400,
      "You cannot mute yourself",
      {
        code: "SELF_MUTE",
      }
    );
  }

  // Make sure the target user exists.
  const { data: targetUser, error: targetError } =
    await supabase
      .from("profiles")
      .select("id")
      .eq("id", mutedId)
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

  // Create the mute relationship.
  const { data, error } = await supabase
    .from("mutes")
    .insert({
      muter_id: muterId,
      muted_id: mutedId,
    })
    .select(`
      muter_id,
      muted_id,
      created_at
    `)
    .single();

  if (error) {
    // PostgreSQL unique violation.
    // This means the user is already muted.
    if (error.code === "23505") {
      throw new AppError(
        409,
        "You have already muted this user",
        {
          code: "ALREADY_MUTED",
        }
      );
    }

    throw error;
  }

  return data;
}

// unmute a user
export async function unmuteUser(
  muterId: UserId,
  mutedId: UserId
) {
  // Prevent trying to unmute yourself.
  if (muterId === mutedId) {
    throw new AppError(
      400,
      "You cannot unmute yourself",
      {
        code: "SELF_UNMUTE",
      }
    );
  }

  const { data, error } = await supabase
    .from("mutes")
    .delete()
    .eq("muter_id", muterId)
    .eq("muted_id", mutedId)
    .select(`
      muter_id,
      muted_id,
      created_at
    `)
    .single();

  if (error) {
    // No mute relationship exists.
    if (error.code === "PGRST116") {
      throw new AppError(
        409,
        "You have not muted this user",
        {
          code: "NOT_MUTED",
        }
      );
    }

    throw error;
  }

  return data;
}

// get mute status between two users
export async function getMuteStatus(
  muterId: UserId,
  mutedId: UserId
) {
  const { data, error } = await supabase
    .from("mutes")
    .select("muter_id")
    .eq("muter_id", muterId)
    .eq("muted_id", mutedId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    muted: !!data,
  };
}