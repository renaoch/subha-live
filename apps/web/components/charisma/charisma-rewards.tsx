"use client";

import { useState } from "react";
import { Crown, Check, Sparkles } from "lucide-react";

import {
  CHARISMA_TIERS,
  CHARISMA_MAX_LEVEL,
  getCharismaTheme,
} from "./charisma-theme";

import { CharismaAllLevelsModal } from "./charisma-all-levels-modal";

interface CharismaRewardsProps {
  currentLevel: number;
}

function LevelChip({
  level,
  state,
}: {
  level: number;
  state: "done" | "current" | "locked";
}) {
  const theme = getCharismaTheme(level);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{
          borderColor:
            state === "locked"
              ? "rgba(255,255,255,0.08)"
              : `${theme.primary}60`,
          background:
            state === "locked"
              ? "rgba(255,255,255,0.02)"
              : `${theme.primary}12`,
          boxShadow:
            state === "current" ? `0 0 18px ${theme.glow}` : "none",
        }}
      >
        {state === "current" ? (
          <Crown className="h-5 w-5" style={{ color: theme.accent }} />
        ) : state === "done" ? (
          <Check className="h-5 w-5" style={{ color: theme.accent }} />
        ) : (
          <span className="text-sm text-white/20">{level}</span>
        )}
      </div>
      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white/40">
        {level}
      </span>
    </div>
  );
}

export function CharismaRewards({
  currentLevel,
}: CharismaRewardsProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const theme = getCharismaTheme(currentLevel);
  const isMax = currentLevel >= CHARISMA_MAX_LEVEL;

  const prevLevel = Math.max(1, currentLevel - 1);
  const nextLevel = Math.min(CHARISMA_MAX_LEVEL, currentLevel + 1);

  return (
    <>
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#17131F] p-6">
        <div
          className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full blur-[100px]"
          style={{ background: theme.glow, opacity: 0.2 }}
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Charisma Path
              </p>
              <h2 className="mt-1 text-xl font-black text-white">
                Charisma Rewards
              </h2>

              <div
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider"
                style={{
                  color: theme.accent,
                  borderColor: `${theme.primary}40`,
                  background: `${theme.primary}12`,
                }}
              >
                <Sparkles className="h-3 w-3" />
                {theme.tierName} · Lv.{currentLevel}
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/40">
              {CHARISMA_MAX_LEVEL} levels
            </span>
          </div>

          {/* Max level banner OR level chips */}
          {isMax ? (
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: `${theme.primary}18` }}
                >
                  <Crown className="h-6 w-6" style={{ color: theme.accent }} />
                </div>
                <div>
                  <p
                    className="text-sm font-black uppercase tracking-wider"
                    style={{ color: theme.accent }}
                  >
                    Max Level Reached
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    You&apos;ve cleared all {CHARISMA_MAX_LEVEL} levels
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-5">
              <LevelChip level={prevLevel} state="done" />
              <LevelChip level={currentLevel} state="current" />
              <LevelChip level={nextLevel} state="locked" />
            </div>
          )}

          {/* View path button */}
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.1] py-3.5 text-xs font-black uppercase tracking-wider text-white/60 transition-all duration-300 hover:border-white/20 hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            View Path to Level {CHARISMA_MAX_LEVEL}
          </button>
        </div>
      </section>

      {modalOpen && (
        <CharismaAllLevelsModal
          currentLevel={currentLevel}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}