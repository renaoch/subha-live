"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, MessagesSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { messagesApi, type Conversation } from "@/lib/api/messages";
import type { RealtimeChannel } from "@supabase/supabase-js";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export default function ChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const refetchTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await messagesApi.conversations();
      setConversations(data);
    } catch {
      // Keep the previous list on failure.
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Realtime: bump the inbox the moment a message addressed to me lands.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let disposed = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const me = data.user?.id;
      if (!me || disposed) return;

      channel = supabase
        .channel(`dm-inbox:${me}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${me}`,
          },
          () => {
            // Debounce a refetch so a burst of messages triggers one query.
            if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
            refetchTimerRef.current = window.setTimeout(() => void refresh(), 250);
          },
        )
        .subscribe();
    })();

    return () => {
      disposed = true;
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const filtered = query.trim()
    ? conversations.filter((c) => {
        const q = query.trim().toLowerCase();
        const name = (c.user?.name || "").toLowerCase();
        const handle = (c.user?.handle || "").toLowerCase();
        return name.includes(q) || handle.includes(q);
      })
    : conversations;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-10 pt-8 text-foreground sm:px-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Inbox</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <span className="pb-1 text-sm text-muted-foreground">{conversations.length} conversations</span>
        </div>
      </header>

      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search conversations"
          placeholder="Search conversations"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessagesSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {query ? "No conversations match your search" : "No conversations yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Message a friend from their profile to start chatting.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {filtered.map((chat) => {
            const name = chat.user?.name || "User";
            return (
              <Link
                key={chat.otherId}
                href={`/home/chats/${chat.otherId}`}
                className="group flex items-center gap-3 py-4 transition-opacity hover:opacity-75"
              >
                <Avatar name={name} src={chat.user?.avatar ?? undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeLabel(chat.lastAt)}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{chat.lastMessage}</p>
                </div>
                {chat.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                    {chat.unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
