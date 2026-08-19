"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CHATS, MOCK_MESSAGES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const chat = MOCK_CHATS.find((c) => c.id === id) ?? MOCK_CHATS[0];
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    MOCK_MESSAGES.filter((m) => m.chatId === id),
  );
  const [draft, setDraft] = useState("");

  const grouped = useMemo(() => messages, [messages]);

  function send() {
    if (!draft.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        chatId: id,
        senderId: "me",
        text: draft.trim(),
        timeLabel: "Now",
      },
    ]);
    setDraft("");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pt-4">
      <header className="flex items-center gap-3 border-b border-border/60 pb-3">
        <button onClick={() => router.back()} className="text-ink-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <Avatar name={chat.userName} size="sm" online />

        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">{chat.userName}</p>
          <p className="text-xs text-emerald-500">Online</p>
        </div>

        <MoreVertical className="h-5 w-5 text-ink-muted" />
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {grouped.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col",
              m.senderId === "me" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.senderId === "me"
                  ? "rounded-br-sm bg-gradient-to-r from-accent to-accent-hot text-white"
                  : "rounded-bl-sm bg-surface-raised text-ink",
              )}
            >
              {m.text}
            </div>
            <span className="mt-1 text-[10px] text-ink-muted">
              {m.timeLabel}
            </span>
          </div>
        ))}
      </div>

      <div className="sticky bottom-24 flex items-center gap-2 rounded-full border border-border bg-surface-raised px-2 py-1.5 shadow-sm">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 bg-transparent px-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <button
          onClick={send}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-hot text-white disabled:opacity-40"
          disabled={!draft.trim()}
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}