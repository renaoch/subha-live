"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_CHATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ChatsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-24 pt-8 text-foreground sm:px-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Inbox</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <span className="pb-1 text-sm text-muted-foreground">{MOCK_CHATS.length} conversations</span>
        </div>
      </header>

      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input aria-label="Search conversations" placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <button aria-label="Filter conversations" className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-sm font-medium text-muted-foreground">Recent</h2>
          <button className="text-xs text-muted-foreground transition-colors hover:text-foreground">Mark all read</button>
        </div>
        <div className="divide-y divide-border/60">
          {MOCK_CHATS.map((chat) => (
            <Link key={chat.id} href={`/home/chats/${chat.id}`} className="group flex items-center gap-3 py-4 transition-opacity hover:opacity-75">
              <Avatar name={chat.userName} size="md" online />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{chat.userName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{chat.timeLabel}</span>
                </div>
                <p className={cn("truncate text-sm", chat.isTyping ? "text-foreground" : "text-muted-foreground")}>
                  {chat.isTyping ? "Typing…" : chat.lastMessage}
                </p>
              </div>
              {chat.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">{chat.unreadCount}</span>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
