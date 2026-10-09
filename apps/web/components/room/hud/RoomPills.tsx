"use client";

import { ChevronRight, Flame, MoreHorizontal, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

/** "🔥 Top 1" — the host's rank among all hosts today. Hidden with no rank. */
export function TopRankPill({ rank, className }: { rank: number | null; className?: string }) {
  if (!rank) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-[#ffb04a]/25 bg-black/45 px-3 py-1.5 backdrop-blur-xl",
        className,
      )}
      style={{ boxShadow: "0 0 14px rgba(255,150,40,0.18)" }}
    >
      <Flame className="h-4 w-4 fill-[#ff8a1f] text-[#ffb04a]" />
      <span className="text-[13px] font-bold leading-none text-[#ffd98a]">Top {rank}</span>
    </div>
  );
}

/** "Explore ›" — jumps to the room list while this room keeps playing in the mini player. */
export function ExplorePill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-[#c26bff]/40 bg-[#2a0f45]/55 py-1.5 pl-2.5 pr-2 backdrop-blur-xl transition active:scale-95"
      style={{ boxShadow: "0 0 16px rgba(170,80,255,0.25)" }}
    >
      <Orbit className="h-[18px] w-[18px] text-[#e2a8ff]" strokeWidth={2} />
      <span className="text-[13px] font-semibold leading-none text-[#f0c9ff]">Explore</span>
      <ChevronRight className="h-4 w-4 text-white/80" />
    </button>
  );
}

/** Small round "more" button (share, levels, camera…) kept next to the rank pill. */
export function MoreDotsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More actions"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur-xl transition active:scale-90"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}
