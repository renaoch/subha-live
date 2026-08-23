"use client";

import { useState } from "react";
import { X, Check, Crown, Lock, ChevronDown, ChevronUp } from "lucide-react";

import {
  CHARISMA_TIERS,
  CHARISMA_MAX_LEVEL,
  getCharismaTheme,
} from "./charisma-theme";

interface CharismaAllLevelsModalProps {
  currentLevel: number;
  onClose: () => void;
}

export function CharismaAllLevelsModal({
  currentLevel,
  onClose,
}: CharismaAllLevelsModalProps) {
  const currentTierIndex = CHARISMA_TIERS.findIndex(
    (tier) => currentLevel >= tier.min && currentLevel <= tier.max,
  );

  const [expandedIndex, setExpandedIndex] = useState<number>(
    currentTierIndex === -1 ? 0 : currentTierIndex,
  );

  const barProgress = Math.min(
    100,
    (currentLevel / CHARISMA_MAX_LEVEL) * 100,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-[#17131F]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-[32px] border-b border-white/5 bg-[#1C1726] p-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
            Charisma Path
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">All Levels</h2>
          <p className="mt-1 text-sm font-bold text-amber-300">
            Level {currentLevel}{" "}
            <span className="font-normal text-white/30">
              of {CHARISMA_MAX_LEVEL}
            </span>
          </p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-amber-300 to-rose-400"
              style={{ width: `${Math.max(2, barProgress)}%` }}
            />
          </div>
        </div>

        {/* Tier accordion */}
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
          {CHARISMA_TIERS.map((tier, index) => {
            const theme = getCharismaTheme(tier.min);
            const isExpanded = expandedIndex === index;
            const isCurrentTier = index === currentTierIndex;

            const levelsInTier = tier.max - tier.min + 1;
            const unlockedInTier = Math.min(
              Math.max(0, currentLevel - tier.min + 1),
              levelsInTier,
            );
            const isTierComplete = unlockedInTier >= levelsInTier;

            return (
              <div
                key={tier.tierName}
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: isCurrentTier
                    ? `${theme.primary}50`
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <button
                  onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background:
                        unlockedInTier > 0
                          ? `${theme.primary}18`
                          : "rgba(255,255,255,0.03)",
                      boxShadow: isCurrentTier
                        ? `0 0 14px ${theme.glow}`
                        : "none",
                    }}
                  >
                    {isCurrentTier ? (
                      <Crown className="h-4.5 w-4.5" style={{ color: theme.accent }} />
                    ) : isTierComplete ? (
                      <Check className="h-4.5 w-4.5" style={{ color: theme.accent }} />
                    ) : (
                      <Lock className="h-4 w-4 text-white/20" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-white">{tier.tierName}</h3>
                      <span className="text-xs font-bold text-white/30">
                        Lv {tier.min}–{tier.max}
                      </span>
                      {isCurrentTier && (
                        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                          You&apos;re here
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/25">
                      {unlockedInTier}/{levelsInTier} unlocked
                    </p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-white/30" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />
                  )}
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-4 gap-2 border-t border-white/5 p-4">
                    {Array.from(
                      { length: levelsInTier },
                      (_, i) => tier.min + i,
                    ).map((level) => {
                      const done = level < currentLevel;
                      const isCurrent = level === currentLevel;

                      return (
                        <div
                          key={level}
                          className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3"
                          style={{
                            borderColor:
                              done || isCurrent
                                ? `${theme.primary}40`
                                : "rgba(255,255,255,0.06)",
                            background: isCurrent
                              ? `${theme.primary}14`
                              : "transparent",
                          }}
                        >
                          {isCurrent ? (
                            <Crown className="h-4 w-4" style={{ color: theme.accent }} />
                          ) : done ? (
                            <Check className="h-4 w-4" style={{ color: theme.accent }} />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-white/15" />
                          )}
                          <span className="text-[10px] font-bold text-white/40">
                            Lv {level}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}