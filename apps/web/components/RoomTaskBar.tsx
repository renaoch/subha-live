// components/RoomTaskBar.tsx
"use client";

import { Target, PartyPopper, Coins, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomTask } from "@/lib/api/room-tasks";

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface RoomTaskBarProps {
  task: RoomTask | null;
  /** Called when the viewer taps CLAIM. Omit for the host's own view. */
  onClaim?: () => void;
  claiming?: boolean;
}

/**
 * Sits directly under the main header row (host identity / viewer
 * count), spanning the same horizontal padding. Fully transparent
 * glass so it never competes with the video behind it — no solid
 * background, just a hairline, blur, and a soft gradient fill for the
 * progress itself.
 *
 * States: active (in progress) -> completed, unclaimed (CLAIM button,
 * only rendered once the backend says isCompleted) -> claimed.
 * Cancelled/expired tasks render nothing (handled by the caller
 * clearing `task`, or by the status guard below).
 */
export function RoomTaskBar({ task, onClaim, claiming }: RoomTaskBarProps) {
  if (!task || (task.status !== "active" && task.status !== "completed")) {
    return null;
  }

  const completed = task.status === "completed";
  const hasReward = task.rewardCoins > 0;
  // isClaimed is only known when the request was authenticated (viewer/host
  // logged in). If it's undefined (anonymous read), we simply never show
  // the claim button rather than guessing.
  const claimable = completed && hasReward && task.isClaimed === false && !!onClaim;
  const claimed = completed && hasReward && task.isClaimed === true;

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
          {claimed ? (
            <Check className="h-3.5 w-3.5 text-emerald-200" />
          ) : completed ? (
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

        {hasReward && (
          <div
            className={cn(
              "relative flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
              claimed ? "bg-white/10 text-white/50" : "bg-[#F5B93F]/15 text-[#F5B93F]",
            )}
          >
            <Coins className="h-3 w-3" />+{formatCompact(task.rewardCoins)}
          </div>
        )}

        {claimable ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="relative flex shrink-0 items-center gap-1 rounded-full bg-[#F5B93F] px-3 py-1 text-[11px] font-black text-[#17131F] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            {claiming ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
          </button>
        ) : claimed ? (
          <span className="relative shrink-0 text-[10px] font-black uppercase tracking-wider text-white/40">
            Claimed
          </span>
        ) : (
          <div className="relative shrink-0 text-[11px] font-bold leading-none text-white/90">
            {formatCompact(task.currentValue)}
            <span className="text-white/50">/{formatCompact(task.targetValue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
