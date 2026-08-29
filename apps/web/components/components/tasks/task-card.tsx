// File: components/tasks/task-card.tsx
"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import type { TaskItem } from "@/lib/api/tasks";
import { RewardPills } from "./reward-pills";

interface TaskCardProps {
  task: TaskItem;
  claiming: boolean;
  onClaim: () => void;
}

export function TaskCard({ task, claiming, onClaim }: TaskCardProps) {
  const { progress } = task;
  const pct = Math.min(100, (progress.progress / progress.targetCount) * 100);
  const ready = progress.isCompleted && !progress.isClaimed;
  const claimed = progress.isClaimed;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border p-4 transition-all",
        ready
          ? "border-[#F5B93F]/40 bg-gradient-to-br from-[#2A1D0C]/70 to-[#17131F]"
          : claimed
            ? "border-white/[0.05] bg-white/[0.012] opacity-60"
            : "border-white/[0.07] bg-white/[0.02]",
      ].join(" ")}
    >
      {ready && (
        <div className="tk-glow pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#F5B93F]/20 blur-3xl" />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg",
              claimed
                ? "border-white/[0.06] bg-white/[0.02] text-white/20"
                : ready
                  ? "border-[#F5B93F]/40 bg-[#F5B93F]/15 text-[#F5B93F]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50",
            ].join(" ")}
          >
            {task.icon ?? "✦"}
          </div>

          <div className="min-w-0">
            <p className={`truncate text-sm font-black ${claimed ? "text-white/40" : "text-white"}`}>
              {task.title}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/25">
              {task.type}
            </p>
          </div>
        </div>

        {claimed ? (
          <span className="tk-check-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-white/30">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/30">
            {progress.progress}/{progress.targetCount}
          </span>
        )}
      </div>

      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: ready
              ? "linear-gradient(90deg, #F5B93F, #FFDA9E)"
              : claimed
                ? "rgba(255,255,255,0.15)"
                : "linear-gradient(90deg, #A86CFF, #57C2FF)",
          }}
        />
      </div>

      <div className="relative mt-3 flex items-center justify-between gap-3">
        <RewardPills
          coins={task.reward.coins}
          diamonds={task.reward.diamonds}
          exp={task.reward.exp}
          muted={claimed}
        />

        {claimed ? (
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-white/20">
            Claimed
          </span>
        ) : ready ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="tk-pulse flex shrink-0 items-center gap-1.5 rounded-xl bg-[#F5B93F] px-3.5 py-2 text-[11px] font-black text-[#17131F] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Claim"}
          </button>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-white/20">
            <Circle className="h-2.5 w-2.5" />
            In progress
          </span>
        )}
      </div>
    </div>
  );
}