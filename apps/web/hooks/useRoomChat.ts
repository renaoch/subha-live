"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatHistory, type RoomChatMessage } from "@/lib/api/chat";
import { chatWsUrl, getAccessToken } from "@/lib/api/realtime";

const RECONNECT_DELAY_MS = 3000;
const HISTORY_LIMIT = 50;

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

/**
 * Live room chat over the realtime service WebSocket
 * (`/ws/rooms/:roomId/chat`). Loads persisted history first, then merges
 * live messages as they arrive. Owns nothing durable — messages are the
 * server's, this hook only mirrors them.
 */
export function useRoomChat(roomId: string, roomStatus?: string | null) {
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [state, setState] = useState<ConnectionState>("idle");
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  // Map for dedupe across live + history (a message can arrive on both).
  const messagesRef = useRef<Map<string, RoomChatMessage>>(new Map());
  const activeRef = useRef(true);

  const upsert = useCallback((incoming: RoomChatMessage[]) => {
    for (const m of incoming) messagesRef.current.set(m.id, m);
    const sorted = [...messagesRef.current.values()].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
    setMessages(sorted);
  }, []);

  const connect = useCallback(async () => {
    if (!activeRef.current) return;

    const url = chatWsUrl(roomId);
    if (!url) {
      setState("disconnected");
      return;
    }

    setState("connecting");
    const token = await getAccessToken();
    const target = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const socket = new WebSocket(target);
    socketRef.current = socket;

    socket.onopen = () => setState("connected");

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === "connected") {
          setSelfUserId(msg.userId ?? null);
          return;
        }
        if (msg && msg.type === "error") {
          console.warn("[useRoomChat] server error:", msg.code, msg.message);
          return;
        }
        // Otherwise it's a canonical chat message.
        if (msg && typeof msg.id === "string" && typeof msg.message === "string") {
          upsert([
            {
              id: msg.id,
              roomId: msg.roomId,
              userId: msg.userId,
              username: msg.username,
              avatar: typeof msg.avatar === "string" ? msg.avatar : null,
              message: msg.message,
              createdAt: msg.createdAt,
            },
          ]);
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      setState("disconnected");
      if (activeRef.current) {
        window.setTimeout(() => void connect(), RECONNECT_DELAY_MS);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [roomId, upsert]);

  // Initial history + (re)connect while the room is live/waiting.
  useEffect(() => {
    if (!roomId || (roomStatus !== "live" && roomStatus !== "created")) {
      activeRef.current = false;
      socketRef.current?.close();
      setMessages([]);
      messagesRef.current.clear();
      return;
    }

    activeRef.current = true;
    messagesRef.current.clear();

    fetchChatHistory(roomId, HISTORY_LIMIT)
      .then((page) => {
        // History is newest-first; reverse to oldest-first for display.
        upsert([...page.messages].reverse());
      })
      .catch(() => {
        // Best-effort: start empty and rely on live messages.
      });

    void connect();

    return () => {
      activeRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [roomId, roomStatus, connect, upsert]);

  const send = useCallback(
    (text: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type: "chat_message", message: text }));
      return true;
    },
    [],
  );

  return { messages, state, selfUserId, send };
}