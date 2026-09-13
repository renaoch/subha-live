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
    const supabase = createClient();

    (async () => {
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
    <main className="relative mx-auto min-h-dvh w-full max-w-2xl bg-surface pb-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-brand-radial" />

      <header className="glass-panel sticky top-0 z-30 rounded-none border-x-0 border-t-0 px-5 pb-3 pt-5 sm:px-8">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-hot">
          <MessagesSquare className="h-3 w-3" />
          Inbox
        </p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="mt-0.5 font-display text-[1.8rem] font-black tracking-[-0.04em] text-ink">
            Chat
          </h1>
          <span className="pb-1 text-sm text-ink-muted">{conversations.length} conversations</span>
        </div>

        <div className="stage-card mt-4 flex items-center gap-3 px-4 py-3">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-hot" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
            placeholder="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
      </header>

      <section className="relative z-10 px-5 pt-5 sm:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin text-accent-hot" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-surface-raised text-accent-hot">
              <span className="absolute inset-0 rounded-[28px] bg-accent-hot/10 animate-glow-pulse" />
              <MessagesSquare className="relative h-8 w-8" />
            </div>
            <p className="mt-5 text-lg font-bold text-ink">
              {query ? "No conversations match your search" : "No conversations yet"}
            </p>
            <p className="mt-1 max-w-xs text-sm leading-6 text-ink-muted">
              Message a friend from their profile to start chatting.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((chat) => {
              const name = chat.user?.name || "User";
              const hasUnread = chat.unread > 0;
              return (
                <Link
                  key={chat.otherId}
                  href={`/home/chats/${chat.otherId}`}
                  className="stage-card flex items-center gap-3 p-3 transition hover:border-accent-hot/40 hover:glow-hot"
                >
                  <span className={hasUnread ? "avatar-ring shrink-0" : "avatar-ring-static shrink-0"}>
                    <Avatar name={name} src={chat.user?.avatar ?? undefined} size="md" className="ring-2 ring-surface" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-ink">{name}</p>
                      <span className="shrink-0 text-xs text-ink-faint">{timeLabel(chat.lastAt)}</span>
                    </div>
                    <p className="truncate text-xs text-ink-muted">{chat.lastMessage}</p>
                  </div>
                  {hasUnread && (
                    <span className="grad-brand flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white">
                      {chat.unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
