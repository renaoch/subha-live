"use client";

import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usersApi } from "@/lib/api/users";
import { messagesApi, type DmMessage, type Friendship } from "@/lib/api/messages";
import { useDmThread } from "@/hooks/useDmThread";
import type { PublicProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const {
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
  } = useDmThread(id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const pendingScrollRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  // Profile + friendship (for the header + the friend gate).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      usersApi.getById(id).catch(() => null),
      messagesApi
        .friendship(id)
        .catch(() => ({ areFriends: false, isBlocked: false, freeMessagesRemaining: 3 })),
    ]).then(([p, f]) => {
      if (cancelled) return;
      setProfile(p);
      setFriendship(f);
      setLoadingMeta(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-scroll to bottom on new messages (only when near bottom, or own send).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const mine = !!last && last.senderId === myId;
    if (mine || atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, myId]);

  // Preserve viewport when older messages are prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingScrollRef.current !== null) {
      el.scrollTop = el.scrollHeight - pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && !loadingOlder) {
      pendingScrollRef.current = el.scrollHeight;
      void loadOlder();
    }
  }

  function onInput(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      sendTyping(true);
      lastTypingSentRef.current = now;
    }
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTyping(false);
      lastTypingSentRef.current = 0;
    }, 2500);
  }

  const canSend =
    !!friendship && (friendship.areFriends || (friendship.freeMessagesRemaining ?? 0) > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !canSend) return;
    setSending(true);
    setDraft("");
    sendTyping(false);
    try {
      await send(text);
      // A free (non-friend) message was just spent — decrement locally so
      // the counter/lock updates immediately without waiting on a refetch.
      setFriendship((prev) =>
        prev && !prev.areFriends && prev.freeMessagesRemaining !== null
          ? { ...prev, freeMessagesRemaining: Math.max(0, prev.freeMessagesRemaining - 1) }
          : prev,
      );
    } catch {
      // Optimistic rollback is handled inside the hook.
    } finally {
      setSending(false);
    }
  }

  const name = profile?.name || profile?.handle || "User";
  const statusLine = typing ? "typing…" : online ? "Online" : "Offline";

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col text-foreground">
      {/* Fixed header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link href={`/user/${id}`} className="shrink-0">
          <Avatar name={name} src={profile?.avatar ?? undefined} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className={cn("truncate text-xs", online || typing ? "text-emerald-400" : "text-muted-foreground")}>
            {statusLine}
          </p>
        </div>
      </header>

      {loadingMeta || loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : friendship?.isBlocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <p className="max-w-xs text-sm font-medium text-muted-foreground">
            You can&apos;t message this user.
          </p>
        </div>
      ) : (
        <>
          {/* Scrollable message list only */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            {hasMore && (
              <div className="pb-3 text-center">
                {loadingOlder ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-xs text-muted-foreground/60">Scroll up for older messages</span>
                )}
              </div>
            )}
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-sm text-muted-foreground">Say hi to {name} 👋</p>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} mine={m.senderId === myId} />)
            )}
          </div>

          {friendship && !friendship.areFriends && (
            <p className="px-5 pb-1 text-center text-[11px] text-muted-foreground">
              {(friendship.freeMessagesRemaining ?? 0) > 0
                ? `${friendship.freeMessagesRemaining} free message${friendship.freeMessagesRemaining === 1 ? "" : "s"} left before you follow each other`
                : "Free messages used up — follow each other to keep chatting"}
            </p>
          )}

          {/* Fixed input */}
          <form
            onSubmit={submit}
            className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-background/80 px-3 py-3 backdrop-blur"
          >
            <input
              value={draft}
              onChange={(e) => onInput(e.target.value)}
              placeholder={canSend ? "Write a message" : "Follow each other to keep chatting"}
              aria-label="Message"
              maxLength={2000}
              disabled={!canSend}
              className="min-w-0 flex-1 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || sending || !canSend}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

const Bubble = ({ message, mine }: { message: DmMessage; mine: boolean }) => (
  <div className={cn("mb-1 flex flex-col", mine ? "items-end" : "items-start")}>
    <div
      className={cn(
        "max-w-[78%] px-4 py-2.5 text-sm leading-relaxed",
        mine ? "rounded-2xl rounded-br-md bg-foreground text-background" : "rounded-2xl rounded-bl-md bg-muted text-foreground",
      )}
    >
      {message.content}
    </div>
  </div>
);