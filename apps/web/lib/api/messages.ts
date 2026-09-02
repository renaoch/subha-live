import { apiFetch } from "@/lib/api/client";

interface Envelope<T> {
  success: boolean;
  data: T;
}

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

export const messagesApi = {
  conversations() {
    return apiFetch<Envelope<Conversation[]>>("/api/v1/messages/conversations").then(
      (r) => r.data,
    );
  },

  friendship(userId: string) {
    return apiFetch<Envelope<Friendship>>(
      `/api/v1/messages/${encodeURIComponent(userId)}/friendship`,
    ).then((r) => r.data);
  },

  thread(userId: string) {
    return apiFetch<Envelope<DmMessage[]>>(
      `/api/v1/messages/${encodeURIComponent(userId)}`,
    ).then((r) => r.data);
  },

  send(userId: string, content: string) {
    return apiFetch<Envelope<DmMessage>>(`/api/v1/messages/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }).then((r) => r.data);
  },
};
