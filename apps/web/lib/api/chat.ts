import { chatHistoryUrl, getAccessToken } from "@/lib/api/realtime";

export interface RoomChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: string | null;
  message: string;
  createdAt: number;
  /** Client-only: true while this message is optimistically shown before the
      server has echoed it back. Never set by the API. */
  pending?: boolean;
}

export interface ChatHistoryPage {
  messages: RoomChatMessage[];
  nextCursor: string | null;
}

/**
 * Fetch persisted chat history from the live-room realtime service. The
 * service returns messages newest-first; callers should reverse for display.
 * Falls back to an empty page when the realtime service is not configured.
 */
export async function fetchChatHistory(
  roomId: string,
  limit = 50,
  before?: string,
): Promise<ChatHistoryPage> {
  const url = chatHistoryUrl(roomId);
  if (!url) return { messages: [], nextCursor: null };

  const token = await getAccessToken();
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);

  const res = await fetch(`${url}?${params.toString()}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    // History is best-effort; a failure just means we start with an empty feed.
    console.error(`[chat] history failed (${res.status}) for room ${roomId}`);
    return { messages: [], nextCursor: null };
  }

  const data = (await res.json()) as ChatHistoryPage;
  return data ?? { messages: [], nextCursor: null };
}