import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { Database } from "../../types/database.types";

type DmRow = Database["public"]["Tables"]["direct_messages"]["Row"];

export interface DmMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string | null;
}

export interface ConversationUser {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  is_verified: boolean;
  level: number;
}

export interface Conversation {
  otherId: string;
  lastMessage: string;
  lastAt: string | null;
  unread: number;
  user: ConversationUser | null;
}

export interface Friendship {
  areFriends: boolean;
  isBlocked: boolean;
}

function toMessage(
  row: Pick<DmRow, "id" | "sender_id" | "recipient_id" | "encrypted_content" | "is_read" | "created_at">,
): DmMessage {
  return {
    id: row.id,
    senderId: row.sender_id ?? "",
    recipientId: row.recipient_id ?? "",
    content: row.encrypted_content,
    isRead: row.is_read ?? false,
    createdAt: row.created_at,
  };
}

/** Mutual follows == friends. */
async function areFriends(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return true;
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .or(
      `and(follower_id.eq.${userA},following_id.eq.${userB}),and(follower_id.eq.${userB},following_id.eq.${userA})`,
    );
  return !error && (data?.length ?? 0) >= 2;
}

/** Blocked if either user blocks the other. */
async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
    );
  return (data?.length ?? 0) > 0;
}

async function getProfiles(ids: string[]): Promise<Map<string, ConversationUser>> {
  const map = new Map<string, ConversationUser>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, handle, avatar, is_verified, level")
    .in("id", ids);
  for (const p of (data ?? []) as any[]) {
    map.set(p.id, {
      id: p.id,
      name: p.name ?? p.handle ?? "User",
      handle: p.handle ?? "",
      avatar: p.avatar ?? null,
      is_verified: p.is_verified ?? false,
      level: p.level ?? 1,
    });
  }
  return map;
}

export const messagesService = {
  async friendship(userId: string, otherUserId: string): Promise<Friendship> {
    if (userId === otherUserId) {
      return { areFriends: true, isBlocked: false };
    }
    const [friends, blocked] = await Promise.all([
      areFriends(userId, otherUserId),
      isBlocked(userId, otherUserId),
    ]);
    return { areFriends: friends, isBlocked: blocked };
  },

  async listConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, encrypted_content, is_read, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new AppError(500, "Failed to load conversations", {
        code: "DM_LIST_FAILED",
        details: error.message,
      });
    }

    const convos = new Map<string, Conversation>();
    for (const row of (data ?? []) as DmRow[]) {
      const other = row.sender_id === userId ? row.recipient_id : row.sender_id;
      if (!other) continue;
      const unread = !row.is_read && row.recipient_id === userId ? 1 : 0;
      const existing = convos.get(other);
      if (!existing) {
        convos.set(other, {
          otherId: other,
          lastMessage: row.encrypted_content,
          lastAt: row.created_at,
          unread,
          user: null,
        });
      } else {
        existing.unread += unread;
      }
    }

    const profiles = await getProfiles([...convos.keys()]);
    const conversations = [...convos.values()].map((c) => ({
      ...c,
      user: profiles.get(c.otherId) ?? null,
    }));

    conversations.sort(
      (a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime(),
    );
    return conversations;
  },

  async getThread(userId: string, otherUserId: string): Promise<DmMessage[]> {
    // Mark incoming messages as read.
    await supabase
      .from("direct_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("sender_id", otherUserId)
      .eq("is_read", false);

    const { data, error } = await supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, encrypted_content, is_read, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError(500, "Failed to load messages", {
        code: "DM_THREAD_FAILED",
        details: error.message,
      });
    }
    return (data ?? []).map(toMessage);
  },

  async sendMessage(userId: string, otherUserId: string, content: string): Promise<DmMessage> {
    if (userId === otherUserId) {
      throw new AppError(400, "You cannot message yourself", { code: "DM_SELF" });
    }

    const [friends, blocked] = await Promise.all([
      areFriends(userId, otherUserId),
      isBlocked(userId, otherUserId),
    ]);

    if (blocked) {
      throw new AppError(403, "You cannot message this user", { code: "DM_BLOCKED" });
    }
    if (!friends) {
      throw new AppError(403, "You must follow each other to start a conversation", {
        code: "DM_NOT_FRIENDS",
      });
    }

    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        id: `dm_${randomUUID()}`,
        sender_id: userId,
        recipient_id: otherUserId,
        encrypted_content: content,
        is_read: false,
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError(500, "Failed to send message", {
        code: "DM_SEND_FAILED",
        details: error.message,
      });
    }
    return toMessage(data as DmRow);
  },
};
