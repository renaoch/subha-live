"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Coins,
  Flame,
  Gift,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDailyRewards } from "@/hooks/useDailyRewards";
import type { DailyRewardDefinition, DailyRewardOverview } from "@/lib/api/rewards";

function formatCoins(n: number) {
  return Math.trunc(n).toLocaleString("en-IN");
}

export default function RewardsPage() {
  const { overview, loading, error, claiming, lastResult, justClaimed, claim } =
    useDailyRewards();

  if (loading) {
    return (
      <Shell>
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-3xl bg-white/[0.04]" />
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
        </div>
      </Shell>
    );
  }

  if (error && !overview) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  if (!overview) return null;

  return (
    <Shell>
      {/* Streak summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Flame}
          label="Current streak"
          value={`${overview.currentStreak} days`}
          accent="from-orange-400/20 to-rose-500/10"
        />
        <StatCard
          icon={Trophy}
          label="Longest streak"
          value={`${overview.longestStreak} days`}
          accent="from-amber-400/20 to-orange-500/10"
        />
      </div>

      {/* Balance */}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[#F5C96A]/15 bg-[#F5C96A]/[0.06] px-4 py-2.5">
        <Coins className="h-4 w-4 text-[#F5C96A]" />
        <span className="text-sm font-bold text-white">{formatCoins(overview.coins)} Coins</span>
      </div>

      {/* 7-day calendar */}
      <section className="mt-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <Gift className="h-4 w-4 text-[#E8C27A]" /> Daily check-in rewards
        </h2>

        <div className="grid grid-cols-7 gap-1.5">
          {overview.schedule.map((day) => (
            <DayCell key={day.dayIndex} day={day} overview={overview} />
          ))}
        </div>
      </section>

      {/* Claim button */}
      <div className="mt-6">
        {overview.alreadyClaimedToday ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-center">
            <p className="text-sm font-bold text-emerald-300">Checked in today ✓</p>
            <p className="mt-1 text-xs text-white/50">
              Come back tomorrow to continue your streak.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void claim()}
            disabled={claiming}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E8C27A] to-[#C9923A] py-4 text-base font-black text-[#1A1424] shadow-[0_12px_30px_-12px_rgba(232,194,122,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
          >
            {claiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            {claiming ? "Claiming…" : `Claim ${formatCoins(todayReward(overview))} coins`}
          </button>
        )}
        {error && <p className="mt-2 text-center text-sm text-rose-300">{error}</p>}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
        Rewards reset at midnight UTC. Claim once per day — your streak grows each day you
        check in and resets if you miss a day.
      </p>

      {/* Claim success animation */}
      <AnimatePresence>
        {justClaimed && lastResult && (
          <ClaimOverlay amount={lastResult.rewardCoins} dayIndex={lastResult.dayIndex} />
        )}
      </AnimatePresence>
    </Shell>
  );
}

function todayReward(overview: DailyRewardOverview): number {
  return overview.schedule[overview.todayDayIndex - 1]?.rewardCoins ?? 0;
}

function DayCell({
  day,
  overview,
}: {
  day: DailyRewardDefinition;
  overview: DailyRewardOverview;
}) {
  const claimed = overview.claimedDays.includes(day.dayIndex);
  const isToday = day.dayIndex === overview.todayDayIndex;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border py-2",
        claimed
          ? "border-emerald-400/20 bg-emerald-500/10"
          : isToday
            ? "border-[#E8C27A]/60 bg-[#E8C27A]/10 shadow-[0_0_16px_rgba(232,194,122,0.15)]"
            : "border-white/[0.06] bg-white/[0.03]",
      )}
    >
      <span className={cn("text-[10px] font-bold", isToday ? "text-[#E8C27A]" : "text-white/40")}>
        Day {day.dayIndex}
      </span>
      <Coins className="h-3.5 w-3.5 text-[#F5C96A]" />
      <span className="text-[10px] font-semibold text-white/80">{formatCoins(day.rewardCoins)}</span>
      {claimed && <span className="text-[9px] text-emerald-300">✓</span>}
      {isToday && <span className="text-[9px] text-[#E8C27A]">Today</span>}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/[0.06] bg-gradient-to-br p-4", accent)}>
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="h-4 w-4 text-[#E8C27A]" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#0d0a12] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 50% at 50% -10%, rgba(232,194,122,0.12), transparent 60%), radial-gradient(90% 40% at 100% 100%, rgba(168,85,247,0.14), transparent 60%), #0d0a12",
        }}
      />
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-12 pt-4">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Profile
          </Link>
          <h1 className="text-lg font-black tracking-tight text-white">Daily Rewards</h1>
          <span className="w-[72px]" />
        </div>
        {children}
      </div>
    </main>
  );
}

function ClaimOverlay({ amount, dayIndex }: { amount: number; dayIndex: number }) {
  const particles = useMemo(
    () => Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      x: `${(i % 5) * 22 - 44}px`,
      delay: `${i * 30}ms`,
    })),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative flex flex-col items-center rounded-3xl border border-[#E8C27A]/40 bg-[#1A1424] px-10 py-8 text-center shadow-[0_0_60px_rgba(232,194,122,0.3)]"
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute h-2 w-2 rounded-full bg-[#E8C27A]"
            style={{
              left: "50%",
              top: "50%",
              animation: `claim-burst 0.9s ease-out ${p.delay} forwards`,
              ["--tx" as string]: p.x,
            }}
          />
        ))}
        <Gift className="h-10 w-10 text-[#E8C27A]" />
        <p className="mt-3 text-2xl font-black text-white">+{formatCoins(amount)}</p>
        <p className="mt-1 text-sm font-semibold text-[#E8C27A]">Day {dayIndex} claimed!</p>
      </motion.div>

      <style jsx>{`
        @keyframes claim-burst {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), -80px) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </motion.div>
  );
}
