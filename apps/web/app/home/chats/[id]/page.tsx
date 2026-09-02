"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { usersApi } from "@/lib/api/users";
import { messagesApi, type DmMessage } from "@/lib/api/messages";
import type { PublicProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [areFriends, setAreFriends] = useState<boolean | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const me = data.user?.id ?? null;

      const [p, friendship] = await Promise.all([
        usersApi.getById(id).catch(() => null),
        messagesApi.friendship(id).catch(() => ({ areFriends: false, isBlocked: false })),
      ]);

      if (cancelled) return;
      setMyId(me);
      setProfile(p);
      setAreFriends(friendship.areFriends);
      setIsBlocked(friendship.isBlocked);

      if (friendship.areFriends) {
        const thread = await messagesApi.thread(id).catch(() => []);
        if (!cancelled) setMessages(thread);
      }
      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !areFriends) return;
    setSending(true);
    try {
      const msg = await messagesApi.send(id, text);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    } catch (err) {
      console.error("send failed", err);
    } finally {
      setSending(false);
    }
  }

  const name = profile?.name || profile?.handle || "User";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-5 pt-5 text-foreground sm:px-8">
      <header className="flex items-center gap-3 border-b border-border/60 pb-5">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LinkAvatar href={`/user/${id}`} name={name} src={profile?.avatar ?? undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile?.handle ? `@${profile.handle}` : "Friend"}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !areFriends ? (
        /* Not friends — no chat box, just the gate message */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <p className="max-w-xs text-sm font-medium text-muted-foreground">
            You have to follow each other to start a conversation
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto py-6">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Say hi to {name} 👋
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === myId;
                return (
                  <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[78%] px-4 py-2.5 text-sm leading-relaxed",
                        mine
                          ? "rounded-2xl rounded-br-md bg-foreground text-background"
                          : "rounded-2xl rounded-bl-md bg-muted text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-2 py-2 shadow-sm">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message"
              aria-label="Message"
              maxLength={2000}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

function LinkAvatar({ href, name, src }: { href: string; name: string; src?: string }) {
  return (
    <Link href={href} className="shrink-0">
      <Avatar name={name} src={src} size="sm" />
    </Link>
  );
}
