"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { messagesApi, type DmMessage } from "@/lib/api/messages";
import type { RealtimeChannel } from "@supabase/supabase-js";

function rowToMessage(row: Record<string, unknown>): DmMessage {
  return {
    id: String(row.id ?? ""),
    senderId: String(row.sender_id ?? ""),
    recipientId: String(row.recipient_id ?? ""),
    content: String(row.encrypted_content ?? ""),
    isRead: Boolean(row.is_read),
    createdAt: (row.created_at as string) ?? null,
  };
}

/**
 * Realtime DM thread over Supabase Realtime (no polling):
 *  - postgres_changes -> new messages pushed instantly
 *  - broadcast -> typing indicator
 *  - presence -> online status
 * Plus cursor pagination for loading older messages on scroll-up.
 */
export function useDmThread(otherUserId: string) {
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myIdRef = useRef<string | null>(null);
  const otherRef = useRef(otherUserId);
  otherRef.current = otherUserId;

  // Initial load (latest page).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const me = data.user?.id ?? null;
      if (cancelled) return;
      myIdRef.current = me;
      setMyId(me);
      if (!me) {
        setLoading(false);
        return;
      }
      try {
        const res = await messagesApi.thread(otherUserId, { limit: 50 });
        if (!cancelled) {
          setMessages(res.messages);
          setHasMore(res.hasMore);
        }
      } catch {
        // Best-effort; realtime will still deliver live messages.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  // Realtime channel (messages + typing + presence).
  useEffect(() => {
    if (!myId || !otherUserId) return;

    const supabase = createClient();
    const channel = supabase.channel(`dm:${[myId, otherUserId].sort().join(":")}`, {
      config: { broadcast: { self: false }, presence: { key: myId } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${myId}`,
        },
        (payload) => {
          const n = payload.new as Record<string, unknown> | undefined;
          if (!n || String(n.sender_id) !== otherUserId) return;
          const msg = rowToMessage(n);
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          messagesApi.markRead(otherUserId).catch(() => {});
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload && payload.userId === otherUserId) {
          setTyping(Boolean(payload.typing));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string }>();
        const metas = state[otherUserId] ?? [];
        setOnline(metas.length > 0);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: myId });
        }
      });

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myId, otherUserId]);

  const send = useCallback(
    async (text: string) => {
      const me = myIdRef.current;
      if (!me) return;
      const optimistic: DmMessage = {
        id: `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        senderId: me,
        recipientId: otherUserId,
        content: text,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const msg = await messagesApi.send(otherUserId, text);
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        throw e;
      }
    },
    [otherUserId],
  );

  const sendTyping = useCallback((isTyping: boolean) => {
    const me = myIdRef.current;
    if (!me) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: me, typing: isTyping },
    });
  }, []);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const res = await messagesApi.thread(otherUserId, {
        before: oldest?.createdAt ?? undefined,
        limit: 50,
      });
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const older = res.messages.filter((m) => !ids.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(res.hasMore);
    } catch {
      // Ignore; user can scroll up again to retry.
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, otherUserId]);

  return {
    messages,
    hasMore,
    loading,
    loadingOlder,
    myId,
    typing,
    online,
    send,
    sendTyping,
    loadOlder,
  };
}
