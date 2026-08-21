// File: app/tasks/page.tsx
"use client";

import { Sparkles } from "lucide-react";

import { useTasks } from "@/hooks/use-tasks";
import { TaskSection } from "@/components/tasks/task-section";
import { ClaimCelebration } from "@/components/tasks/claim-celebration";
import { TasksMotionStyles } from "@/components/tasks/tasks-motion-styles";

export default function TasksPage() {
  const {
    groupedTasks,
    loading,
    error,
    claimingId,
    claim,
    celebration,
    dismissCelebration,
    summary,
  } = useTasks();

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0C0911] px-4 py-6 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded bg-white/[0.04]" />
          <div className="mt-8 h-28 animate-pulse rounded-[28px] border border-white/[0.05] bg-white/[0.02]" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const pct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const ringCircumference = 2 * Math.PI * 28;

  return (
    <main className="min-h-dvh overflow-hidden bg-[#0C0911] text-[#F8F1E6]">
      <TasksMotionStyles />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[460px] w-[640px] -translate-x-1/2 rounded-full bg-[#F5B93F]/[0.06] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <header>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F5B93F]/20 bg-[#F5B93F]/10 text-[#F5B93F]">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Earn & Level Up
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Daily Tasks</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-white/35">
            Complete tasks to earn coins, diamonds and XP.
          </p>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Summary */}
        <section className="relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#15111B] p-5">
          <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#F5B93F]/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                Today&apos;s Progress
              </p>
              <p className="mt-1 text-2xl font-black">
                {summary.completed}/{summary.total}{" "}
                <span className="text-sm font-bold text-white/30">completed</span>
              </p>
              {summary.claimableCount > 0 && (
                <p className="mt-1 text-xs font-bold text-[#F5B93F]">
                  {summary.claimableCount} reward{summary.claimableCount > 1 ? "s" : ""} ready to
                  claim
                </p>
              )}
            </div>

            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#F5B93F"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - pct / 100)}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black">
                {pct}%
              </span>
            </div>
          </div>
        </section>

        {groupedTasks.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-14 text-center">
            <p className="text-sm font-bold text-white/40">No tasks available right now</p>
            <p className="mt-1 text-xs text-white/20">Check back soon.</p>
          </div>
        ) : (
          groupedTasks.map((group) => (
            <TaskSection
              key={group.type}
              type={group.type}
              tasks={group.items}
              claimingId={claimingId}
              onClaim={claim}
            />
          ))
        )}
      </div>

      {celebration && (
        <ClaimCelebration
          coins={celebration.coins}
          diamonds={celebration.diamonds}
          exp={celebration.exp}
          onDismiss={dismissCelebration}
        />
      )}
    </main>
  );
}