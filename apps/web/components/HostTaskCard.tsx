"use client";

import { Check, Coins, Loader2, PartyPopper, Target, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostTaskStats, ViewerHostTask } from "@/lib/api/host-task";

function formatHours(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}`;
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatRemaining(ms: number | null): string | null {
  if (ms === null) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface HostTaskCardProps {
  task: ViewerHostTask | null;
  /** Host sees rollup stats instead of the CLAIM button — tasks targeting
      the host are configured from the admin console, not from inside the
      room, so there is no in-room "Manage" action here. */
  isHost?: boolean;
  onClaim?: () => void;
  claiming?: boolean;
  stats?: HostTaskStats | null;
}

function metricLabel(task: ViewerHostTask): string {
  if (task.targetHours != null) return "hours";
  if (task.targetCoins != null) return "coins";
  return "";
}

function progressLabel(task: ViewerHostTask): { value: string; target: string } {
  if (task.targetHours != null) {
    return { value: formatHours(task.progress.hours), target: formatHours(task.targetHours) };
  }
  if (task.targetCoins != null) {
    return { value: formatCoins(task.progress.coins), target: formatCoins(task.targetCoins) };
  }
  return { value: "0", target: "0" };
}

/**
 * Host task / user-reward card. Sits directly below the viewer count,
 * spanning the same horizontal padding, rendered as transparent glass so it
 * reads as part of the room header rather than a new block.
 *
 * States: active -> in_progress -> completed (CLAIM) -> claimed, plus
 * expired / not_eligible. The backend is the source of truth for completion;
 * the CLAIM button only appears once the server reports `completed`.
 */
export function HostTaskCard({ task, isHost, onClaim, claiming, stats }: HostTaskCardProps) {
  if (!task) return null;

  const state = task.state;
  const hasReward = task.rewardAmount > 0;
  const percent = Math.max(0, Math.min(100, task.progress.percent));

  // Non-participating states are muted, one-liners.
  if (state === "expired") {
    return (
      <div className="relative mt-2 px-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-xl">
          <Timer className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/50">
            {task.title} — ended
          </p>
        </div>
      </div>
    );
  }

  if (state === "not_eligible") {
    return (
      <div className="relative mt-2 px-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-xl">
          <Target className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/50">
            {task.title} — not eligible for this challenge
          </p>
        </div>
      </div>
    );
  }

  const completed = state === "completed" || state === "claimed";
  const claimed = state === "claimed";
  const claimable = completed && !claimed && hasReward && !!onClaim;
  const remaining = formatRemaining(task.remainingMs);
  const { value, target } = progressLabel(task);
  const label = metricLabel(task);

  return (
    <div className="relative mt-2 px-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-3 backdrop-blur-xl transition-colors",
          completed
            ? "border-emerald-300/25 bg-emerald-400/10"
            : "border-white/15 bg-black/25",
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              completed ? "bg-emerald-400/20" : "bg-white/10",
            )}
          >
            {claimed ? (
              <Check className="h-4 w-4 text-emerald-200" />
            ) : completed ? (
              <PartyPopper className="h-4 w-4 text-emerald-200" />
            ) : (
              <Target className="h-4 w-4 text-white/85" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-white">
              {task.title}
            </p>
            {task.description ? (
              <p className="truncate text-[11px] leading-tight text-white/45">
                {task.description}
              </p>
            ) : null}
          </div>

          {remaining && !claimed && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/70">
              <Timer className="h-3 w-3" />
              {remaining}
            </div>
          )}
        </div>

        {/* Progress */}
        {!claimed && (
          <div className="mt-2.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  completed
                    ? "bg-emerald-400"
                    : "bg-gradient-to-r from-[#FF3B5C] to-[#FF3B5C]/60",
                )}
                style={{ width: `${Math.max(percent, 3)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
              <span className="text-white/90">
                {completed ? (
                  <>
                    <Check className="mr-1 inline h-3 w-3 text-emerald-300" />
                    Completed
                  </>
                ) : (
                  <>
                    {value}
                    <span className="text-white/45">/{target} {label}</span>
                  </>
                )}
              </span>
              <span className={completed ? "text-emerald-300" : "text-white/50"}>
                {Math.round(percent)}%
              </span>
            </div>
          </div>
        )}

        {/* Footer: reward / claim / manage / stats */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {hasReward && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black leading-none",
                  claimed ? "bg-white/10 text-white/45" : "bg-[#F5B93F]/15 text-[#F5B93F]",
                )}
              >
                <Coins className="h-3.5 w-3.5" />+{formatCoins(task.rewardAmount)}
              </span>
            )}
            {claimed && (
              <span className="truncate text-[11px] font-semibold text-emerald-300">
                +{formatCoins(task.rewardAmount)} coins added to your balance
              </span>
            )}
          </div>

          {isHost ? (
            stats && (
              <span className="shrink-0 text-[10px] font-medium text-white/45">
                {stats.eligibleUsers} joined · {stats.completedUsers} done · {stats.claimedUsers} claimed
              </span>
            )
          ) : claimable ? (
            <button
              type="button"
              onClick={onClaim}
              disabled={claiming}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F5B93F] px-4 py-1.5 text-[12px] font-black text-[#17131F] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Claim reward"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}