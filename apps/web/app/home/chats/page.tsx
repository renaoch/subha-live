"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CHATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ChatsPage() {
  const [tab, setTab] = useState<"realmatch" | "messages">("messages");

  return (
    <main className="mx-auto max-w-[560px] px-4 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["realmatch", "messages"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
                tab === t
                  ? "bg-accent-hot text-white"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {t === "realmatch" ? "Realmatch" : "Messages"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5">
        <Search className="h-4 w-4 text-ink-muted" />
        <input
          placeholder="Search here..."
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <SlidersHorizontal className="h-4 w-4 text-ink-muted" />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Message</h2>
        <button className="text-xs font-medium text-accent">View all</button>
      </div>

      <div className="mt-2">
        {MOCK_CHATS.map((chat) => (
          <a
            key={chat.id}
            href={`/home/chats/${chat.id}`}
            className="flex items-center gap-3 border-b border-border/50 py-3"
          >
            <Avatar name={chat.userName} size="md" online />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {chat.userName}
              </p>
              <p
                className={cn(
                  "truncate text-xs",
                  chat.isTyping ? "text-accent" : "text-ink-muted",
                )}
              >
                {chat.lastMessage}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-ink-muted">
                {chat.timeLabel}
              </span>
              {chat.unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-hot text-[11px] font-semibold text-white">
                  {chat.unreadCount}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}