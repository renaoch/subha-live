"use client";

import type { LevelProgress } from "@/lib/api/levels";

interface LevelHeroProps {
  progress: LevelProgress;
}

export function LevelHero({
  progress,
}: LevelHeroProps) {
  const {
    currentLevel,
    currentXp,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    progress: progressPercent,
    currentTitle,
    nextTitle,
  } = progress;

  const isMaxLevel = nextLevelXp === null;

  const xpNeeded = isMaxLevel
    ? 0
    : Math.max(
        0,
        nextLevelXp - totalXp,
      );

  const xpRange = isMaxLevel
    ? 1
    : Math.max(
        1,
        nextLevelXp - currentLevelXp,
      );

  const barProgress = Math.min(
    100,
    Math.max(
      0,
      ((totalXp - currentLevelXp) /
        xpRange) *
        100,
    ),
  );

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-gradient-to-br from-[#29203D] via-[#211A32] to-[#17131F] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#9B6DFF]/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-[#D9A94A]/10 blur-[70px]" />

      {/* Top label */}
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
            Your journey
          </p>

          <h2 className="mt-1 text-xl font-bold text-[#F8F1E6]">
            Level Progress
          </h2>
        </div>

        <div className="rounded-full border border-[#D9A94A]/20 bg-[#D9A94A]/10 px-3 py-1.5">
          <span className="text-xs font-semibold text-[#E1B85A]">
            {isMaxLevel
              ? "MAX LEVEL"
              : `${xpNeeded.toLocaleString()} XP TO GO`}
          </span>
        </div>
      </div>

      {/* Main level display */}
      <div className="relative mt-8 flex items-center gap-5">
        {/* Level orb */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#D9A94A]/20" />

          <div className="absolute inset-2 rounded-full border border-[#D9A94A]/30" />

          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#D9A94A] via-[#B9812D] to-[#76521D] shadow-[0_0_35px_rgba(217,169,74,0.28)]" />

          <div className="relative z-10 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
              LVL
            </p>

            <p className="text-4xl font-black leading-none text-[#17131F]">
              {currentLevel}
            </p>
          </div>
        </div>

        {/* Level information */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/40">
            Current level
          </p>

          <h3 className="mt-1 truncate text-2xl font-bold text-[#F8F1E6]">
            {currentTitle ??
              `Level ${currentLevel}`}
          </h3>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#D9A94A] shadow-[0_0_10px_rgba(217,169,74,0.7)]" />

            <span className="text-xs text-white/45">
              {isMaxLevel
                ? "You've reached the top"
                : nextTitle
                  ? `Next: ${nextTitle}`
                  : `Keep earning XP`}
            </span>
          </div>
        </div>
      </div>

      {/* XP stats */}
      <div className="relative mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <p className="text-xs text-white/35">
            Total XP
          </p>

          <p className="mt-1 text-xl font-bold text-[#F8F1E6]">
            {totalXp.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <p className="text-xs text-white/35">
            Level XP
          </p>

          <p className="mt-1 text-xl font-bold text-[#F8F1E6]">
            {currentXp.toLocaleString()}
          </p>
        </div>
      </div>

      {/* XP progress */}
      <div className="relative mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-white/45">
            {isMaxLevel
              ? "Maximum level reached"
              : "Progress to next level"}
          </span>

          <span className="text-xs font-bold text-[#D9A94A]">
            {Math.round(
              isMaxLevel
                ? 100
                : Math.min(
                    progressPercent,
                    100,
                  ),
            )}
            %
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full border border-white/[0.06] bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A86CFF] via-[#C785FF] to-[#E0B75B] shadow-[0_0_18px_rgba(199,133,255,0.35)] transition-all duration-700"
            style={{
              width: `${Math.max(
                2,
                isMaxLevel
                  ? 100
                  : barProgress,
              )}%`,
            }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[11px] text-white/30">
          <span>
            Level {currentLevel}
          </span>

          <span>
            {isMaxLevel
              ? "MAX"
              : `Level ${
                  currentLevel + 1
                }`}
          </span>
        </div>
      </div>
    </section>
  );
}