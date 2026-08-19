"use client";

import { useMemo, useState } from "react";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_ROOMS, gradientFor } from "@/lib/mock-data";
import { mediaBadgeLabel } from "@/lib/api/rooms";
import type { LiveRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { key: LiveRoom["category"]; label: string }[] = [
  { key: "nearby", label: "Nearby" },
  { key: "popular", label: "Popular" },
  { key: "featured", label: "Featured" },
  { key: "explore", label: "Explore" },
];

export default function LivePage() {
  const [tab, setTab] = useState<LiveRoom["category"]>("nearby");

  const rooms = useMemo(
    () => MOCK_ROOMS.filter((r) => r.category === tab),
    [tab],
  );

  return (
    <main className="mx-auto max-w-[560px] px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Subha Live
        </h1>

        <div className="flex items-center gap-2">
          <IconButton icon={<Search className="h-5 w-5" />} />
          <IconButton icon={<Bell className="h-5 w-5" />} />
        </div>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-gradient-to-r from-accent to-accent-hot text-white shadow-sm"
                : "bg-surface-raised text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}

        {rooms.length === 0 && (
          <p className="col-span-2 py-16 text-center text-sm text-ink-muted">
            No live rooms here yet.
          </p>
        )}
      </div>
    </main>
  );
}

function IconButton({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-ink-muted transition-colors hover:text-ink">
      {icon}
    </button>
  );
}

function RoomCard({ room }: { room: LiveRoom }) {
  return (
    <a
      href={`/home/room/${room.id}`}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl shadow-panel"
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br transition-transform duration-300 group-hover:scale-105",
          gradientFor(room.hostName),
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
        {room.countryFlag} {room.viewerCount}
      </span>

      <span
        className={cn(
          "absolute bottom-10 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-white",
          room.mediaType === "video" ? "bg-accent-hot/90" : "bg-indigo-500/90",
        )}
      >
        {mediaBadgeLabel(room.mediaType)}
      </span>

      <div className="absolute inset-x-2 bottom-2 flex items-center gap-2">
        <Avatar name={room.hostName} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {room.hostName}
          </p>
          <p className="truncate text-[11px] text-white/70">{room.title}</p>
        </div>
      </div>
    </a>
  );
}