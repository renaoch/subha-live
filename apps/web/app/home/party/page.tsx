"use client";

import { useState } from "react";
import { Search, Bell, Users, Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_ROOMS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function PartyPage() {
  const [mode, setMode] = useState<"hot" | "video" | "voice">("voice");

  return (
    <main className="mx-auto max-w-[560px] px-4 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex gap-4">
          {(["hot", "video", "voice"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
                mode === m
                  ? "bg-accent-hot text-white"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-ink-muted" />
          <Bell className="h-5 w-5 text-ink-muted" />
        </div>
      </header>

      <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-r from-accent to-accent-hot px-5 py-6 text-white shadow-panel">
        <Crown className="absolute -right-2 -top-2 h-20 w-20 text-white/15" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          Popular
        </p>
        <p className="font-display text-2xl font-bold">Events</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Room</h2>
        <button className="text-xs font-medium text-accent">See all</button>
      </div>

      <div className="mt-3 space-y-3">
        {MOCK_ROOMS.map((room) => (
          <a
            key={room.id}
            href={`/home/room/${room.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 shadow-sm transition-colors hover:border-accent/40"
          >
            <Avatar name={room.hostName} size="md" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {room.countryFlag} Welcome to my room, come say hi 👋
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                ⭐ Lv.{(room.viewerCount % 30) + 1}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-ink-muted">
              <Users className="h-3.5 w-3.5" />
              {room.viewerCount}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}