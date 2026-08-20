"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Coins, Crown, Gem, Lock, Sparkles, X } from "lucide-react";
import type { LevelReward } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
}

const TIER_SIZE = 10;
const MAX_LEVEL = 100;

const TIER_NAMES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Elite",
  "Legend",
  "Mythic",
];

function tierIndexForLevel(level: number) {
  return Math.min(TIER_NAMES.length - 1, Math.floor((level - 1) / TIER_SIZE));
}

function tierName(level: number) {
  return TIER_NAMES[tierIndexForLevel(level)];
}

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

function RewardIcon({
  rewardType,
  className,
}: {
  rewardType: string;
  className?: string;
}) {
  switch (rewardType.toLowerCase()) {
    case "coins":
      return <Coins className={className} />;
    case "diamonds":
      return <Gem className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

/** Inline keyframes so this works regardless of the host tailwind.config. */
function RewardsMotionStyles() {
  return (
    <style>{`
      @keyframes lr-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
        50% { box-shadow: 0 0 0 6px rgba(255,255,255,0.06); }
      }
      @keyframes lr-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes lr-twinkle {
        0%, 100% { opacity: 0.15; transform: scale(0.8); }
        50% { opacity: 0.9; transform: scale(1.15); }
      }
      @keyframes lr-rainbow-spin {
        to { --lr-angle: 360deg; }
      }
      @property --lr-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }
      .lr-pulse { animation: lr-pulse-ring 2.2s ease-in-out infinite; }
      .lr-shimmer-bar {
        background-size: 200% 100%;
        animation: lr-shimmer 2.4s linear infinite;
      }
      .lr-twinkle { animation: lr-twinkle 2.6s ease-in-out infinite; }
      .lr-max-border {
        background: conic-gradient(from var(--lr-angle), #F8B84E, #FF6CA8, #A86CFF, #6CC5FF, #F8B84E);
        animation: lr-rainbow-spin 4s linear infinite;
      }
    `}</style>
  );
}

function Sparkle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="lr-twinkle pointer-events-none absolute h-1 w-1 rounded-full bg-white"
      style={style}
    />
  );
}

/* ---------- Nearby level chip ---------- */

function RewardChip({
  reward,
  unlocked,
  isCurrent,
  isNext,
}: {
  reward: LevelReward;
  unlocked: boolean;
  isCurrent: boolean;
  isNext: boolean;
}) {
  const theme = getLevelTheme(reward.level);
  const isMax = reward.level === MAX_LEVEL;

  return (
    <div className="relative shrink-0">
      {isMax ? (
        <div className="lr-max-border h-[52px] w-[52px] rounded-2xl p-[2px]">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#17131F]">
            <Crown className="h-5 w-5 text-[#F8B84E]" />
          </div>
        </div>
      ) : (
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
            isCurrent ? "lr-pulse" : ""
          }`}
          style={{
            color: unlocked ? theme.accent : isNext ? theme.primary : "rgba(255,255,255,0.25)",
            borderColor: unlocked || isNext ? `${theme.primary}55` : "rgba(255,255,255,0.06)",
            background: unlocked || isNext
              ? `linear-gradient(135deg, ${theme.primary}22, ${theme.primary}08)`
              : "rgba(255,255,255,0.025)",
            boxShadow: unlocked ? `0 0 18px ${theme.glow}` : "none",
          }}
        >
          {unlocked ? (
            <span className="text-sm font-black">✓</span>
          ) : (
            <RewardIcon rewardType={reward.rewardType} className="h-4 w-4" />
          )}
        </div>
      )}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[8px] font-black"
        style={{
          borderColor: unlocked ? `${theme.primary}60` : "rgba(255,255,255,0.08)",
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
      groups.push({ start: chunk[0].level, end: chunk[chunk.length - 1].level, items: chunk });
    }
    return groups;
  }, [rewards]);

  const activeTierIndex = tiers.findIndex((t) => currentLevel >= t.start && currentLevel <= t.end);
  const [openTier, setOpenTier] = useState<number | null>(activeTierIndex === -1 ? 0 : activeTierIndex);
  const activeTierRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeTierRef.current?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockedCount = rewards.filter((r) => r.level <= currentLevel).length;
  const pct = Math.min(100, (unlockedCount / rewards.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#150F1C] sm:h-[85vh] sm:rounded-[28px]">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-[#241734] to-[#17111F] px-5 pb-4 pt-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#A86CFF]/25 blur-[80px]" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#F8B84E]/15 blur-[60px]" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Prestige Path</p>
              <h2 className="mt-1 text-lg font-black text-[#F8F1E6]">All Rewards</h2>
              <p className="mt-1 text-xs font-bold text-white/40">
                <span className="text-[#F8B84E]">{unlockedCount}</span> of {rewards.length} unlocked
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="lr-shimmer-bar h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundImage:
                  "linear-gradient(90deg, #A86CFF, #F8B84E, #FF6CA8, #A86CFF)",
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
              const tierUnlocked = tier.items.filter((r) => r.level <= currentLevel).length;
              const tierTheme = getLevelTheme(tier.start);
              const isComplete = tierUnlocked === tier.items.length;
              const rank = TIER_NAMES[i] ?? `Tier ${i + 1}`;
              const isMythicTier = i === TIER_NAMES.length - 1;

              return (
                <div
                  key={`${tier.start}-${tier.end}`}
                  ref={isActiveTier ? activeTierRef : undefined}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: isActiveTier ? `${tierTheme.primary}55` : "rgba(255,255,255,0.07)",
                    background: isActiveTier
                      ? `linear-gradient(135deg, ${tierTheme.primary}14, rgba(255,255,255,0.02))`
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <button
                    onClick={() => setOpenTier(isOpen ? null : i)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black"
                      style={{
                        color: isComplete ? tierTheme.accent : "rgba(255,255,255,0.4)",
                        borderColor: isComplete ? `${tierTheme.primary}55` : "rgba(255,255,255,0.08)",
                        background: isComplete
                          ? `linear-gradient(135deg, ${tierTheme.primary}30, ${tierTheme.primary}08)`
                          : "rgba(255,255,255,0.02)",
                        boxShadow: isComplete ? `0 0 14px ${tierTheme.glow}` : "none",
                      }}
                    >
                      {isComplete ? (
                        isMythicTier ? <Crown className="h-4 w-4" /> : "✓"
                      ) : (
                        tier.start
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{rank}</span>
                        <span className="text-[10px] font-bold text-white/25">
                          Lv {tier.start}–{tier.end}
                        </span>
                        {isActiveTier && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
                            style={{ color: tierTheme.accent, background: `${tierTheme.primary}20` }}
                          >
                            You're here
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

                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-4 gap-2.5 border-t border-white/[0.05] px-4 pb-4 pt-4">
                        {tier.items.map((reward) => {
                          const unlocked = currentLevel >= reward.level;
                          const isNext = !unlocked && reward.level === currentLevel + 1;
                          const theme = getLevelTheme(reward.level);
                          const isMax = reward.level === MAX_LEVEL;

                          if (isMax) {
                            return (
                              <div key={reward.id} className="col-span-4 relative overflow-hidden rounded-2xl p-[2px]">
                                <div className="lr-max-border absolute inset-0" />
                                <div className="relative flex items-center justify-between gap-3 rounded-[14px] bg-[#1B1424] px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F8B84E]/25 to-[#FF6CA8]/25">
                                      <Crown className="h-5 w-5 text-[#F8B84E]" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wider text-[#F8B84E]">Max Level</p>
                                      <p className="text-[11px] text-white/40">Level 100 · {rewardLabel(reward.rewardType)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div
                                      className="text-base font-black"
                                      style={{ color: unlocked ? "#F8B84E" : "rgba(255,255,255,0.35)" }}
                                    >
                                      +{reward.rewardAmount.toLocaleString()}
                                    </div>
                                    {unlocked && (
                                      <span className="text-[8px] font-black uppercase tracking-wider text-[#F8B84E]/70">Unlocked</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={reward.id}
                              className="flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all"
                              style={{
                                borderColor: unlocked ? `${theme.primary}35` : "rgba(255,255,255,0.05)",
                                background: unlocked
                                  ? `linear-gradient(160deg, ${theme.primary}16, rgba(255,255,255,0.015))`
                                  : "rgba(255,255,255,0.015)",
                              }}
                            >
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl border text-xs"
                                style={{
                                  color: unlocked ? theme.accent : isNext ? theme.primary : "rgba(255,255,255,0.25)",
                                  borderColor: unlocked || isNext ? `${theme.primary}45` : "rgba(255,255,255,0.06)",
                                  background: unlocked || isNext ? `${theme.primary}14` : "rgba(255,255,255,0.02)",
                                  boxShadow: unlocked ? `0 0 10px ${theme.glow}` : "none",
                                }}
                              >
                                {unlocked ? (
                                  <span className="text-xs font-black">✓</span>
                                ) : reward.level - currentLevel > 3 ? (
                                  <Lock className="h-3 w-3" />
                                ) : (
                                  <RewardIcon rewardType={reward.rewardType} className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <span className="text-[9px] font-black text-white/60">Lv {reward.level}</span>
                              <span
                                className="text-[10px] font-black"
                                style={{ color: unlocked ? theme.accent : "rgba(255,255,255,0.3)" }}
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

  const sortedRewards = useMemo(() => [...rewards].sort((a, b) => a.level - b.level), [rewards]);
  const nextReward = sortedRewards.find((reward) => reward.level > currentLevel);
  const isMaxed = !nextReward && currentLevel >= MAX_LEVEL;

  const nearbyRewards = useMemo(() => {
    const nextIndex = nextReward ? sortedRewards.findIndex((r) => r.id === nextReward.id) : sortedRewards.length;
    const start = Math.max(0, nextIndex - 1);
    return sortedRewards.slice(start, start + 5);
  }, [sortedRewards, nextReward]);

  const currentTheme = getLevelTheme(Math.max(1, currentLevel));
  const levelsToGo = nextReward ? nextReward.level - currentLevel : 0;

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border p-5"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background: `radial-gradient(circle at 100% 0%, ${currentTheme.primary}14, #17131F 55%)`,
      }}
    >
      <RewardsMotionStyles />

      {/* Ambient background */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px]" style={{ background: `${currentTheme.primary}22` }} />
      <Sparkle style={{ top: "12%", left: "78%", animationDelay: "0.2s" }} />
      <Sparkle style={{ top: "30%", left: "88%", animationDelay: "1s" }} />
      <Sparkle style={{ top: "6%", left: "60%", animationDelay: "1.6s" }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Prestige Path</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-black text-[#F8F1E6]">Level Rewards</h2>
            </div>
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider"
              style={{
                color: currentTheme.accent,
                borderColor: `${currentTheme.primary}45`,
                background: `${currentTheme.primary}14`,
              }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {tierName(currentLevel)} · Lv {currentLevel}
            </span>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/35">
            {sortedRewards.length} milestones
          </span>
        </div>

        {/* Next reward / Max level hero */}
        {isMaxed ? (
          <div className="relative mt-5 overflow-hidden rounded-2xl p-[2px]">
            <div className="lr-max-border absolute inset-0" />
            <div className="relative flex items-center justify-between gap-3 rounded-[14px] bg-[#1B1424] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F8B84E]/25 to-[#FF6CA8]/25">
                  <Crown className="h-6 w-6 text-[#F8B84E]" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#F8B84E]">Max Level Reached</p>
                  <p className="mt-0.5 text-[11px] text-white/40">You've cleared all {MAX_LEVEL} levels</p>
                </div>
              </div>
            </div>
          </div>
        ) : nextReward ? (
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
              style={{ background: getLevelTheme(nextReward.level).glow }}
            />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">
                  {levelsToGo === 1 ? "1 level to go" : `${levelsToGo} levels to go`}
                </p>
                <p className="mt-1 text-sm font-black text-white">Level {nextReward.level}</p>
                <p className="mt-1 text-xs text-white/35">{rewardLabel(nextReward.rewardType)} reward</p>
                <div className="mt-2.5 h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(6, 100 - (levelsToGo / TIER_SIZE) * 100)}%`,
                      background: `linear-gradient(90deg, ${getLevelTheme(nextReward.level).primary}, ${getLevelTheme(nextReward.level).accent})`,
                    }}
                  />
                </div>
              </div>

              <div
                className="lr-pulse flex h-14 w-14 items-center justify-center rounded-2xl border text-lg"
                style={{
                  color: getLevelTheme(nextReward.level).primary,
                  borderColor: `${getLevelTheme(nextReward.level).primary}50`,
                  background: `linear-gradient(135deg, ${getLevelTheme(nextReward.level).primary}25, ${getLevelTheme(nextReward.level).primary}08)`,
                  boxShadow: `0 0 22px ${getLevelTheme(nextReward.level).glow}`,
                }}
              >
                <RewardIcon rewardType={nextReward.rewardType} className="h-6 w-6" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Nearby levels strip */}
        {nearbyRewards.length > 0 && (
          <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2 pt-3">
            {nearbyRewards.map((reward) => (
              <RewardChip
                key={reward.id}
                reward={reward}
                unlocked={currentLevel >= reward.level}
                isCurrent={reward.level === currentLevel}
                isNext={reward.id === nextReward?.id}
              />
            ))}
          </div>
        )}

        {/* View all trigger */}
        {sortedRewards.length > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-black uppercase tracking-wider transition-all hover:brightness-110"
            style={{
              borderColor: `${currentTheme.primary}40`,
              background: `linear-gradient(135deg, ${currentTheme.primary}20, ${currentTheme.primary}08)`,
              color: currentTheme.accent,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            View all {sortedRewards.length} levels
          </button>
        )}

        {/* Empty */}
        {sortedRewards.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-white/20" />
            <p className="mt-3 text-sm font-bold text-white/40">No rewards yet</p>
            <p className="mt-1 text-xs text-white/20">More milestones are coming.</p>
          </div>
        )}
      </div>

      {showAll && (
        <AllRewardsModal rewards={sortedRewards} currentLevel={currentLevel} onClose={() => setShowAll(false)} />
      )}
    </section>
  );
}