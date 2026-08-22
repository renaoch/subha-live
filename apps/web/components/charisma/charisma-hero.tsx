"use client";

import { Sparkles } from "lucide-react";

import type { CharismaProgress } from "@/lib/api/charisma";

import { getCharismaTheme } from "./charisma-theme";

interface CharismaHeroProps {
  progress: CharismaProgress;
}

export function CharismaHero({
  progress,
}: CharismaHeroProps) {
  const theme = getCharismaTheme(
    progress.currentLevel,
  );

  const isMaxTier =
    progress.nextLevel === null;

  const charismaRange = isMaxTier
    ? 1
    : Math.max(
        1,
        (progress.nextLevelCharisma ?? 0) -
          progress.currentLevelCharisma,
      );

  const barProgress = isMaxTier
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          ((progress.totalCharisma -
            progress.currentLevelCharisma) /
            charismaRange) *
            100,
        ),
      );

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-white/10 p-6"
      style={{
        background: theme.background,
        boxShadow: `
          0 20px 80px rgba(0,0,0,0.45),
          0 0 60px ${theme.glow}
        `,
      }}
    >
      {/* Background aura */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-140px] h-[320px] w-[320px] -translate-x-1/2 rounded-full blur-[100px]"
        style={{
          background: theme.glow,
          opacity: 0.28 * theme.intensity,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: theme.secondary }}
            >
              Charisma Tier
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              {theme.tierName}
            </h2>
          </div>

          <div
            className="rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              color: theme.accent,
              borderColor: `${theme.primary}40`,
              background: `${theme.primary}12`,
            }}
          >
            Lv.{progress.currentLevel}
          </div>
        </div>

        {/* Central badge + total */}
        <div className="mt-10 flex flex-col items-center">
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full"
            style={{
              border: `3px solid ${theme.primary}`,
              boxShadow: `
                0 0 20px ${theme.glow},
                inset 0 0 20px ${theme.glow}
              `,
              background: `
                radial-gradient(
                  circle at 50% 35%,
                  ${theme.secondary}20,
                  transparent 65%
                ),
                #15111D
              `,
            }}
          >
            <Sparkles
              className="h-9 w-9"
              style={{
                color: theme.accent,
                filter: `drop-shadow(0 0 8px ${theme.glow})`,
              }}
            />
          </div>

          <div className="mt-5 text-center">
            <p
              className="text-4xl font-black"
              style={{
                color: theme.primary,
                textShadow: `0 0 20px ${theme.glow}`,
              }}
            >
              {progress.totalCharisma.toLocaleString()}
            </p>

            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/35">
              Total Charisma
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/40">
              {progress.currentTitle ?? theme.tierName}
            </span>

            <span
              className="text-xs font-bold"
              style={{ color: theme.secondary }}
            >
              {isMaxTier
                ? "MAX"
                : `${Math.round(barProgress)}%`}
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(2, barProgress)}%`,
                background: `
                  linear-gradient(
                    90deg,
                    ${theme.primary},
                    ${theme.secondary},
                    ${theme.accent}
                  )
                `,
                boxShadow: `0 0 15px ${theme.glow}`,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-white/25">
            <span>
              {progress.totalCharisma.toLocaleString()} pts
            </span>

            <span>
              {isMaxTier
                ? "MAX TIER"
                : `${progress.nextLevelCharisma?.toLocaleString()} pts \u00b7 Lv.${progress.nextLevel}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}