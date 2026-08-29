// components/RoomTaskBar.tsx
"use client";

import { Target, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomTask } from "@/lib/api/room-tasks";

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface RoomTaskBarProps {
  task: RoomTask | null;
}

/**
 * Sits directly under the main header row (host identity / viewer
 * count), spanning the same horizontal padding. Fully transparent
 * glass so it never competes with the video behind it — no solid
 * background, just a hairline, blur, and a soft gradient fill for the
 * progress itself.
 */
export function RoomTaskBar({ task }: RoomTaskBarProps) {
  if (!task || task.status !== "active" && task.status !== "completed") {
    return null;
  }

  const completed = task.status === "completed";

  return (
    <div className="relative mt-2 px-4">
      <div
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-full border px-3 py-2 backdrop-blur-xl transition-colors",
          completed
            ? "border-emerald-300/30 bg-emerald-400/10"
            : "border-white/15 bg-black/25",
        )}
      >
        {/* Progress fill, behind the content */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            completed
              ? "bg-emerald-400/25"
              : "bg-gradient-to-r from-[#FF3B5C]/35 to-[#FF3B5C]/10",
          )}
          style={{ width: `${Math.max(task.progress, 4)}%` }}
        />

        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
          {completed ? (
            <PartyPopper className="h-3.5 w-3.5 text-emerald-200" />
          ) : (
            <Target className="h-3.5 w-3.5 text-white/85" />
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight text-white">
            {task.title}
          </p>
        </div>

        <div className="relative shrink-0 text-[11px] font-bold leading-none text-white/90">
          {formatCompact(task.currentValue)}
          <span className="text-white/50">/{formatCompact(task.targetValue)}</span>
        </div>
      </div>
    </div>
  );
}
