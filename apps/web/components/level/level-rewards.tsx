"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, X } from "lucide-react";
import type { LevelReward } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
}

const TIER_SIZE = 10;

function rewardLabel(rewardType: string) {
  switch (rewardType.toLowerCase()) {
    case "coins":
      return "Coins";
    case "diamonds":
      return "Diamonds";
    default:
      return rewardType;
  }
}

function rewardIcon(rewardType: string) {
  switch (rewardType.toLowerCase()) {
    case "coins":
      return "●";
    case "diamonds":
      return "◆";
    default:
      return "✦";
  }
}

function tierLabel(startLevel: number, endLevel: number) {
  return `Lv ${startLevel}–${endLevel}`;
}

/* ---------- Small building blocks ---------- */

function RewardChip({
  reward,
  unlocked,
  isNext,
  size = "md",
}: {
  reward: LevelReward;
  unlocked: boolean;
  isNext: boolean;
  size?: "sm" | "md";
}) {
  const theme = getLevelTheme(reward.level);
  const dim = size === "sm" ? "h-11 w-11 text-sm" : "h-12 w-12 text-base";

  return (
    <div className="relative shrink-0">
      <div
        className={`flex ${dim} items-center justify-center rounded-2xl border font-black transition-all`}
        style={{
          color: unlocked
            ? theme.accent
            : isNext
              ? theme.primary
              : "rgba(255,255,255,0.25)",
          borderColor:
            unlocked || isNext
              ? `${theme.primary}45`
              : "rgba(255,255,255,0.06)",
          background:
            unlocked || isNext
              ? `${theme.primary}12`
              : "rgba(255,255,255,0.025)",
          boxShadow: unlocked ? `0 0 16px ${theme.glow}` : "none",
        }}
      >
        {unlocked ? "✓" : rewardIcon(reward.rewardType)}
      </div>
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[8px] font-black"
        style={{
          borderColor: unlocked
            ? `${theme.primary}50`
            : "rgba(255,255,255,0.08)",
          background: "#17131F",
          color: unlocked ? theme.accent : "rgba(255,255,255,0.35)",
        }}
      >
        {reward.level}
      </div>
    </div>
  );
}

/* ---------- Modal: full catalogue, grouped into collapsible tiers ---------- */

function AllRewardsModal({
  rewards,
  currentLevel,
  onClose,
}: {
  rewards: LevelReward[];
  currentLevel: number;
  onClose: () => void;
}) {
  const tiers = useMemo(() => {
    const groups: { start: number; end: number; items: LevelReward[] }[] = [];
    for (let i = 0; i < rewards.length; i += TIER_SIZE) {
      const chunk = rewards.slice(i, i + TIER_SIZE);
      if (chunk.length === 0) continue;
      groups.push({
        start: chunk[0].level,
        end: chunk[chunk.length - 1].level,
        items: chunk,
      });
    }
    return groups;
  }, [rewards]);

  const activeTierIndex = tiers.findIndex(
    (t) => currentLevel >= t.start && currentLevel <= t.end,
  );

  const [openTier, setOpenTier] = useState<number | null>(
    activeTierIndex === -1 ? 0 : activeTierIndex,
  );

  const activeTierRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll the active tier into view once, on open.
    activeTierRef.current?.scrollIntoView({
      block: "start",
      behavior: "instant" as ScrollBehavior,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockedCount = rewards.filter((r) => r.level <= currentLevel).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#150F1C] sm:h-[85vh] sm:rounded-[28px]">
        {/* Header */}
        <div className="relative shrink-0 border-b border-white/[0.06] bg-[#1B1424] px-5 pb-4 pt-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#A86CFF]/10 blur-[80px]" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Prestige Path
              </p>
              <h2 className="mt-1 text-lg font-black text-[#F8F1E6]">
                All Rewards
              </h2>
              <p className="mt-1 text-xs font-bold text-white/35">
                {unlockedCount} of {rewards.length} unlocked
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Overall progress bar */}
          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#A86CFF] to-[#F8B84E] transition-all"
              style={{
                width: `${Math.min(100, (unlockedCount / rewards.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Tier list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2.5">
            {tiers.map((tier, i) => {
              const isOpen = openTier === i;
              const isActiveTier = i === activeTierIndex;
              const tierUnlocked = tier.items.filter(
                (r) => r.level <= currentLevel,
              ).length;
              const tierTheme = getLevelTheme(tier.start);
              const isComplete = tierUnlocked === tier.items.length;

              return (
                <div
                  key={`${tier.start}-${tier.end}`}
                  ref={isActiveTier ? activeTierRef : undefined}
                  className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]"
                >
                  <button
                    onClick={() => setOpenTier(isOpen ? null : i)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black"
                      style={{
                        color: isComplete
                          ? tierTheme.accent
                          : "rgba(255,255,255,0.4)",
                        borderColor: isComplete
                          ? `${tierTheme.primary}45`
                          : "rgba(255,255,255,0.08)",
                        background: isComplete
                          ? `${tierTheme.primary}12`
                          : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {isComplete ? "✓" : tier.start}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">
                          {tierLabel(tier.start, tier.end)}
                        </span>
                        {isActiveTier && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
                            style={{
                              color: tierTheme.accent,
                              background: `${tierTheme.primary}15`,
                            }}
                          >
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/30">
                        {tierUnlocked}/{tier.items.length} unlocked
                      </p>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-white/30 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Expandable grid */}
                  <div
                    className="grid transition-all duration-300 ease-out"
                    style={{
                      gridTemplateRows: isOpen ? "1fr" : "0fr",
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-4 gap-2.5 border-t border-white/[0.05] px-4 pb-4 pt-4 xs:grid-cols-5">
                        {tier.items.map((reward) => {
                          const unlocked = currentLevel >= reward.level;
                          const isNext =
                            !unlocked && reward.level === currentLevel + 1;
                          const theme = getLevelTheme(reward.level);

                          return (
                            <div
                              key={reward.id}
                              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.015] py-2.5"
                            >
                              <div className="relative">
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border text-xs"
                                  style={{
                                    color: unlocked
                                      ? theme.accent
                                      : isNext
                                        ? theme.primary
                                        : "rgba(255,255,255,0.25)",
                                    borderColor:
                                      unlocked || isNext
                                        ? `${theme.primary}45`
                                        : "rgba(255,255,255,0.06)",
                                    background:
                                      unlocked || isNext
                                        ? `${theme.primary}12`
                                        : "rgba(255,255,255,0.02)",
                                  }}
                                >
                                  {unlocked ? (
                                    "✓"
                                  ) : reward.level - currentLevel > 3 ? (
                                    <Lock className="h-3 w-3" />
                                  ) : (
                                    rewardIcon(reward.rewardType)
                                  )}
                                </div>
                              </div>
                              <span className="text-[9px] font-black text-white/60">
                                Lv {reward.level}
                              </span>
                              <span
                                className="text-[10px] font-black"
                                style={{
                                  color: unlocked
                                    ? theme.accent
                                    : "rgba(255,255,255,0.3)",
                                }}
                              >
                                +{reward.rewardAmount.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function LevelRewards({ rewards, currentLevel }: LevelRewardsProps) {
  const [showAll, setShowAll] = useState(false);

  const sortedRewards = useMemo(
    () => [...rewards].sort((a, b) => a.level - b.level),
    [rewards],
  );

  const nextReward = sortedRewards.find(
    (reward) => reward.level > currentLevel,
  );

  // A short, centered strip around the current level instead of dumping
  // every milestone on the page — this is what stays visible by default.
  const nearbyRewards = useMemo(() => {
    const nextIndex = nextReward
      ? sortedRewards.findIndex((r) => r.id === nextReward.id)
      : sortedRewards.length;
    const start = Math.max(0, nextIndex - 1);
    return sortedRewards.slice(start, start + 5);
  }, [sortedRewards, nextReward]);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#17131F] p-5">
      {/* Ambient background */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#A86CFF]/10 blur-[90px]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Prestige Path
            </p>
            <h2 className="mt-1 text-xl font-black text-[#F8F1E6]">
              Level Rewards
            </h2>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/35">
            {sortedRewards.length} milestones
          </span>
        </div>

        {/* Next reward */}
        {nextReward && (
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
              style={{ background: getLevelTheme(nextReward.level).glow }}
            />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">
                  Next unlock
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  Level {nextReward.level}
                </p>
                <p className="mt-1 text-xs text-white/35">
                  {rewardLabel(nextReward.rewardType)} reward
                </p>
              </div>

              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border text-lg"
                style={{
                  color: getLevelTheme(nextReward.level).primary,
                  borderColor: `${getLevelTheme(nextReward.level).primary}40`,
                  background: `${getLevelTheme(nextReward.level).primary}10`,
                }}
              >
                {rewardIcon(nextReward.rewardType)}
              </div>
            </div>
          </div>
        )}

        {/* Nearby levels strip */}
        {nearbyRewards.length > 0 && (
          <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2 pt-3">
            {nearbyRewards.map((reward) => (
              <RewardChip
                key={reward.id}
                reward={reward}
                unlocked={currentLevel >= reward.level}
                isNext={reward.id === nextReward?.id}
              />
            ))}
          </div>
        )}

        {/* View all trigger */}
        {sortedRewards.length > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs font-black text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View all {sortedRewards.length} levels
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </button>
        )}

        {/* Empty */}
        {sortedRewards.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <div className="text-2xl text-white/20">✦</div>
            <p className="mt-3 text-sm font-bold text-white/40">
              No rewards yet
            </p>
            <p className="mt-1 text-xs text-white/20">
              More milestones are coming.
            </p>
          </div>
        )}
      </div>

      {showAll && (
        <AllRewardsModal
          rewards={sortedRewards}
          currentLevel={currentLevel}
          onClose={() => setShowAll(false)}
        />
      )}
    </section>
  );
}