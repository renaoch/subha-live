"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CHATS, MOCK_MESSAGES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const chat = MOCK_CHATS.find((c) => c.id === id) ?? MOCK_CHATS[0];
  const [messages, setMessages] = useState<ChatMessage[]>(() => MOCK_MESSAGES.filter((m) => m.chatId === id));
  const [draft, setDraft] = useState("");
  const grouped = useMemo(() => messages, [messages]);

  function send() {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), chatId: id, senderId: "me", text: draft.trim(), timeLabel: "Now" }]);
    setDraft("");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-5 pt-5 text-foreground sm:px-8">
      <header className="flex items-center gap-3 border-b border-border/60 pb-5">
        <button aria-label="Go back" onClick={() => router.back()} className="rounded-full p-2 -ml-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={chat.userName} size="sm" online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{chat.userName}</p>
          <p className="text-xs text-muted-foreground">Active now</p>
        </div>
        <button aria-label="More options" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><MoreVertical className="h-5 w-5" /></button>
      </header>

      <div className="flex flex-1 flex-col justify-end gap-4 overflow-y-auto py-6">
        <p className="pb-2 text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Today</p>
        {grouped.map((message) => {
          const mine = message.senderId === "me";
          return (
            <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div className={cn("max-w-[78%] px-4 py-3 text-sm leading-relaxed", mine ? "rounded-2xl rounded-br-md bg-foreground text-background" : "rounded-2xl rounded-bl-md bg-muted text-foreground")}>
                {message.text}
              </div>
              <span className="mt-1.5 px-1 text-[11px] text-muted-foreground">{message.timeLabel}</span>
            </div>
          );
        })}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-2 py-2 shadow-sm">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" aria-label="Message" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
        <button type="submit" aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-30" disabled={!draft.trim()}><SendHorizonal className="h-4 w-4" /></button>
      </form>
    </main>
  );
}
