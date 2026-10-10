"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatHistory, type RoomChatMessage } from "@/lib/api/chat";
import { chatWsUrl, getAccessToken } from "@/lib/api/realtime";

const RECONNECT_DELAY_MS = 3000;
const HISTORY_LIMIT = 50;
// A person re-joining within this window reuses their existing "joined" row.
const JOIN_DEDUPE_MS = 10 * 60 * 1000;

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
  const [canChat, setCanChat] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  // Map for dedupe across live + history (a message can arrive on both).
  const messagesRef = useRef<Map<string, RoomChatMessage>>(new Map());
  const activeRef = useRef(true);
  const selfUserIdRef = useRef<string | null>(null);
  // Outstanding optimistic messages we sent, waiting for the server echo —
  // in send order, so the oldest matching text/user is reconciled first.
  const pendingIdsRef = useRef<string[]>([]);

  const upsert = useCallback((incoming: RoomChatMessage[]) => {
    for (const m of incoming) {
      // A gift combo re-publishes the SAME row id with a growing quantity;
      // history replays can arrive out of order, so never let an older,
      // smaller count overwrite a newer one.
      const prev = messagesRef.current.get(m.id);
      if (prev?.kind === "gift" && m.kind === "gift" && prev.gift && m.gift && prev.gift.quantity > m.gift.quantity) {
        continue;
      }
      // One "joined" row per person: a reconnect / second tab / remount must
      // not stack another row. Only a genuine re-join much later is shown again.
      if (prev?.kind === "join" && m.kind === "join" && m.createdAt - prev.createdAt < JOIN_DEDUPE_MS) {
        continue;
      }
      // Keep a combo row where it first appeared in the feed.
      const keepPos = prev?.kind === "gift" && m.kind === "gift";
      messagesRef.current.set(m.id, keepPos ? { ...m, createdAt: prev.createdAt } : m);
    }
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
          selfUserIdRef.current = msg.userId ?? null;
          setCanChat(msg.canChat !== false);
          return;
        }
        if (msg && msg.type === "error") {
          console.warn("[useRoomChat] server error:", msg.code, msg.message);
          return;
        }
        // "User X joined the stream" system row, broadcast by the realtime
        // service whenever a viewer's socket is authorized into the room.
        if (msg && msg.type === "join" && typeof msg.id === "string") {
          upsert([
            {
              // Stable id per (room, user) so repeats collapse into one row.
              id: `join-${msg.roomId}-${msg.userId}`,
              roomId: msg.roomId,
              userId: msg.userId,
              username: msg.username,
              avatar: typeof msg.avatar === "string" ? msg.avatar : null,
              message: "",
              createdAt: msg.createdAt,
              level: typeof msg.level === "number" ? msg.level : undefined,
              tags: Array.isArray(msg.tags) ? msg.tags : undefined,
              kind: "join",
            },
          ]);
          return;
        }
        // Gift row, published by the financial API once a gift transaction
        // completes (see apps/api financial-chat.ts). Relayed unchanged by
        // the realtime service, which never sees coin/diamond amounts.
        if (msg && msg.type === "gift" && typeof msg.id === "string") {
          upsert([
            {
              id: msg.id,
              roomId: msg.roomId,
              userId: msg.userId,
              username: msg.username,
              avatar: typeof msg.avatar === "string" ? msg.avatar : null,
              message: "",
              createdAt: msg.createdAt,
              level: typeof msg.level === "number" ? msg.level : undefined,
              tags: Array.isArray(msg.tags) ? msg.tags : undefined,
              kind: "gift",
              gift: {
                giftId: msg.giftId,
                name: msg.giftName,
                icon: typeof msg.giftIcon === "string" ? msg.giftIcon : null,
                code: msg.giftCode,
                quantity: typeof msg.quantity === "number" ? msg.quantity : 1,
                coinPrice: typeof msg.giftCoinPrice === "number" ? msg.giftCoinPrice : undefined,
                added: typeof msg.added === "number" ? msg.added : undefined,
              },
            },
          ]);
          return;
        }
        // Otherwise it's a canonical chat message.
        if (msg && typeof msg.id === "string" && typeof msg.message === "string") {
          // If this is our own message coming back, reconcile it with the
          // oldest matching optimistic (pending) entry instead of adding a
          // duplicate row.
          if (msg.userId && msg.userId === selfUserIdRef.current && pendingIdsRef.current.length) {
            const idx = pendingIdsRef.current.findIndex((clientId) => {
              const pending = messagesRef.current.get(clientId);
              return pending && pending.message === msg.message;
            });
            if (idx !== -1) {
              const [clientId] = pendingIdsRef.current.splice(idx, 1);
              messagesRef.current.delete(clientId);
            }
          }
          upsert([
            {
              id: msg.id,
              roomId: msg.roomId,
              userId: msg.userId,
              username: msg.username,
              avatar: typeof msg.avatar === "string" ? msg.avatar : null,
              message: msg.message,
              createdAt: msg.createdAt,
              level: typeof msg.level === "number" ? msg.level : undefined,
              tags: Array.isArray(msg.tags) ? msg.tags : undefined,
              kind: "message",
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
    pendingIdsRef.current = [];

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

      // Show it instantly (faded, via `pending`), reconciled with the real
      // row once the server echoes the message back over the socket.
      const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingIdsRef.current.push(clientId);
      upsert([
        {
          id: clientId,
          roomId,
          userId: selfUserIdRef.current ?? "",
          username: "",
          avatar: null,
          message: text,
          createdAt: Date.now(),
          pending: true,
        },
      ]);

      socket.send(JSON.stringify({ type: "chat_message", message: text }));
      return true;
    },
    [roomId, upsert],
  );

  return { messages, state, selfUserId, canChat, send };
}