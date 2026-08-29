"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Coins, Crown, Gem, Lock, Sparkles, X } from "lucide-react";
import type { LevelReward } from "@/lib/api/levels";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
}

const TIER_SIZE = 10;
const MAX_LEVEL = 100;

/**
 * One consistent color per 10-level tier. Every item inside a tier — reward
 * or not — shares this hue. This replaces the old per-level `getLevelTheme`
 * lookup, which was assigning a near-random color to each individual reward
 * and made a single tier look like a handful of unrelated items instead of
 * one cohesive rank.
 */
const TIER_PALETTE = [
  { name: "Bronze", primary: "#D98F4E", accent: "#FFCF9E", glow: "rgba(217,143,78,0.4)" },
  { name: "Silver", primary: "#AEB9C7", accent: "#EAF0F6", glow: "rgba(174,185,199,0.4)" },
  { name: "Gold", primary: "#F5B93F", accent: "#FFE29E", glow: "rgba(245,185,63,0.42)" },
  { name: "Platinum", primary: "#5FD9C4", accent: "#B4F5E7", glow: "rgba(95,217,196,0.4)" },
  { name: "Diamond", primary: "#57C2FF", accent: "#B3E6FF", glow: "rgba(87,194,255,0.4)" },
  { name: "Master", primary: "#A86CFF", accent: "#DCC2FF", glow: "rgba(168,108,255,0.42)" },
  { name: "Grandmaster", primary: "#FF6CA8", accent: "#FFC0DA", glow: "rgba(255,108,168,0.4)" },
  { name: "Elite", primary: "#FF8A5C", accent: "#FFCBAE", glow: "rgba(255,138,92,0.4)" },
  { name: "Legend", primary: "#FFD24C", accent: "#FFF0B8", glow: "rgba(255,210,76,0.42)" },
  { name: "Mythic", primary: "#F8B84E", accent: "#F8F1E6", glow: "rgba(248,184,78,0.5)" },
] as const;

function tierIndexForLevel(level: number) {
  return Math.min(TIER_PALETTE.length - 1, Math.floor((level - 1) / TIER_SIZE));
}

function tierForLevel(level: number) {
  return TIER_PALETTE[tierIndexForLevel(level)];
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

function RewardIcon({ rewardType, className }: { rewardType: string; className?: string }) {
  switch (rewardType.toLowerCase()) {
    case "coins":
      return <Coins className={className} />;
    case "diamonds":
      return <Gem className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

/** Every level 1..MAX_LEVEL, with the matching reward attached where one exists. */
type LadderRung = { level: number; reward: LevelReward | null };

function buildLadder(rewards: LevelReward[], maxLevel: number): LadderRung[] {
  const byLevel = new Map(rewards.map((r) => [r.level, r]));
  return Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    return { level, reward: byLevel.get(level) ?? null };
  });
}

function RewardsMotionStyles() {
  return (
    <style>{`
      @keyframes lr-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        50% { box-shadow: 0 0 0 7px rgba(255,255,255,0.07); }
      }
      @keyframes lr-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes lr-twinkle {
        0%, 100% { opacity: 0.15; transform: scale(0.8); }
        50% { opacity: 0.9; transform: scale(1.15); }
      }
      @keyframes lr-rainbow-spin { to { --lr-angle: 360deg; } }
      @property --lr-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }
      @keyframes lr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      .lr-pulse { animation: lr-pulse-ring 2.1s ease-in-out infinite; }
      .lr-bob { animation: lr-bob 2.4s ease-in-out infinite; }
      .lr-shimmer-bar { background-size: 200% 100%; animation: lr-shimmer 2.2s linear infinite; }
      .lr-twinkle { animation: lr-twinkle 2.6s ease-in-out infinite; }
      .lr-max-border {
        background: conic-gradient(from var(--lr-angle), #F5B93F, #FF6CA8, #A86CFF, #57C2FF, #F5B93F);
        animation: lr-rainbow-spin 4s linear infinite;
      }
    `}</style>
  );
}

function Sparkle({ style }: { style: React.CSSProperties }) {
  return <div className="lr-twinkle pointer-events-none absolute h-1 w-1 rounded-full bg-white" style={style} />;
}

/* ---------- Nearby ladder chip (works for reward rungs and plain levels) ---------- */

function LadderChip({
  rung,
  unlocked,
  isCurrent,
  isNext,
}: {
  rung: LadderRung;
  unlocked: boolean;
  isCurrent: boolean;
  isNext: boolean;
}) {
  const theme = tierForLevel(rung.level);
  const isMax = rung.level === MAX_LEVEL;

  if (isMax) {
    return (
      <div className="relative shrink-0">
        <div className="lr-max-border lr-bob h-[52px] w-[52px] rounded-2xl p-[2px]">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#17131F]">
            <Crown className="h-5 w-5 text-[#F5B93F]" />
          </div>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#F5B93F]/50 bg-[#17131F] px-2 py-0.5 text-[8px] font-black text-[#F5B93F]">
          100
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${isCurrent ? "lr-pulse" : ""}`}
        style={{
          color: unlocked ? theme.accent : isNext ? theme.primary : "rgba(255,255,255,0.25)",
          borderColor: unlocked || isNext ? `${theme.primary}55` : "rgba(255,255,255,0.07)",
          background:
            unlocked || isNext
              ? `linear-gradient(135deg, ${theme.primary}26, ${theme.primary}0A)`
              : "rgba(255,255,255,0.025)",
          boxShadow: unlocked ? `0 0 18px ${theme.glow}` : "none",
        }}
      >
        {unlocked ? (
          <span className="text-sm font-black">✓</span>
        ) : rung.reward ? (
          <RewardIcon rewardType={rung.reward.rewardType} className="h-4 w-4" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        )}
      </div>
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[8px] font-black"
        style={{
          borderColor: unlocked ? `${theme.primary}60` : "rgba(255,255,255,0.08)",
          background: "#17131F",
          color: unlocked ? theme.accent : "rgba(255,255,255,0.35)",
        }}
      >
        {rung.level}
      </div>
    </div>
  );
}

/* ---------- Modal: full 1-100 ladder, grouped into collapsible tiers ---------- */

function AllRewardsModal({
  ladder,
  currentLevel,
  onClose,
}: {
  ladder: LadderRung[];
  currentLevel: number;
  onClose: () => void;
}) {
  const tiers = useMemo(() => {
    const groups: { index: number; start: number; end: number; rungs: LadderRung[] }[] = [];
    for (let i = 0; i < ladder.length; i += TIER_SIZE) {
      const chunk = ladder.slice(i, i + TIER_SIZE);
      if (chunk.length === 0) continue;
      groups.push({ index: groups.length, start: chunk[0].level, end: chunk[chunk.length - 1].level, rungs: chunk });
    }
    return groups;
  }, [ladder]);

  const activeTierIndex = tiers.findIndex((t) => currentLevel >= t.start && currentLevel <= t.end);
  const [openTier, setOpenTier] = useState<number | null>(activeTierIndex === -1 ? 0 : activeTierIndex);
  const activeTierRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeTierRef.current?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockedCount = Math.min(currentLevel, ladder.length);
  const pct = Math.min(100, (unlockedCount / ladder.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#150F1C] sm:h-[85vh] sm:rounded-[28px]">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-[#241734] to-[#17111F] px-5 pb-4 pt-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#A86CFF]/25 blur-[80px]" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#F5B93F]/15 blur-[60px]" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Prestige Path</p>
              <h2 className="mt-1 text-lg font-black text-[#F8F1E6]">All Levels</h2>
              <p className="mt-1 text-xs font-bold text-white/40">
                <span className="text-[#F5B93F]">Level {Math.min(currentLevel, ladder.length)}</span> of {ladder.length}
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
              style={{ width: `${pct}%`, backgroundImage: "linear-gradient(90deg, #A86CFF, #F5B93F, #FF6CA8, #A86CFF)" }}
            />
          </div>
        </div>

        {/* Tier list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2.5">
            {tiers.map((tier) => {
              const isOpen = openTier === tier.index;
              const isActiveTier = tier.index === activeTierIndex;
              const levelsUnlocked = tier.rungs.filter((r) => r.level <= currentLevel).length;
              const rewardCount = tier.rungs.filter((r) => r.reward).length;
              const theme = TIER_PALETTE[tier.index] ?? TIER_PALETTE[TIER_PALETTE.length - 1];
              const isComplete = levelsUnlocked === tier.rungs.length;
              const isMythicTier = tier.index === TIER_PALETTE.length - 1;

              return (
                <div
                  key={`${tier.start}-${tier.end}`}
                  ref={isActiveTier ? activeTierRef : undefined}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: isActiveTier ? `${theme.primary}55` : "rgba(255,255,255,0.07)",
                    background: isActiveTier
                      ? `linear-gradient(135deg, ${theme.primary}16, rgba(255,255,255,0.02))`
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <button
                    onClick={() => setOpenTier(isOpen ? null : tier.index)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black"
                      style={{
                        color: isComplete ? theme.accent : "rgba(255,255,255,0.4)",
                        borderColor: isComplete ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
                        background: isComplete
                          ? `linear-gradient(135deg, ${theme.primary}34, ${theme.primary}0A)`
                          : "rgba(255,255,255,0.02)",
                        boxShadow: isComplete ? `0 0 14px ${theme.glow}` : "none",
                      }}
                    >
                      {isComplete ? isMythicTier ? <Crown className="h-4 w-4" /> : "✓" : tier.start}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-white">{theme.name}</span>
                        <span className="text-[10px] font-bold text-white/25">
                          Lv {tier.start}–{tier.end}
                        </span>
                        {isActiveTier && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
                            style={{ color: theme.accent, background: `${theme.primary}22` }}
                          >
                            You're here
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/30">
                        {levelsUnlocked}/{tier.rungs.length} unlocked
                        {rewardCount > 0 && ` · ${rewardCount} reward${rewardCount > 1 ? "s" : ""}`}
                      </p>
                    </div>

                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-white/30" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />
                    )}
                  </button>

                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-4 gap-2.5 border-t border-white/[0.05] px-4 pb-4 pt-4">
                        {tier.rungs.map((rung) => {
                          const unlocked = currentLevel >= rung.level;
                          const isNext = !unlocked && !tier.rungs.some((r) => r.level < rung.level && r.level > currentLevel);
                          const isMax = rung.level === MAX_LEVEL;

                          if (isMax) {
                            return (
                              <div key={rung.level} className="relative col-span-4 overflow-hidden rounded-2xl p-[2px]">
                                <div className="lr-max-border absolute inset-0" />
                                <div className="relative flex items-center justify-between gap-3 rounded-[14px] bg-[#1B1424] px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F5B93F]/25 to-[#FF6CA8]/25">
                                      <Crown className="h-5 w-5 text-[#F5B93F]" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-wider text-[#F5B93F]">Max Level</p>
                                      <p className="text-[11px] text-white/40">
                                        {rung.reward ? `${rewardLabel(rung.reward.rewardType)} reward` : "The top of the path"}
                                      </p>
                                    </div>
                                  </div>
                                  {rung.reward ? (
                                    <div className="text-right">
                                      <div className="text-base font-black" style={{ color: unlocked ? "#F5B93F" : "rgba(255,255,255,0.35)" }}>
                                        +{rung.reward.rewardAmount.toLocaleString()}
                                      </div>
                                      {unlocked && <span className="text-[8px] font-black uppercase tracking-wider text-[#F5B93F]/70">Unlocked</span>}
                                    </div>
                                  ) : (
                                    <Crown className={`h-5 w-5 ${unlocked ? "text-[#F5B93F]" : "text-white/20"}`} />
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (!rung.reward) {
                            // Plain level — no reward, just a rung on the ladder.
                            return (
                              <div
                                key={rung.level}
                                className="flex flex-col items-center justify-center gap-1 rounded-xl border py-3"
                                style={{
                                  borderColor: unlocked ? `${theme.primary}25` : "rgba(255,255,255,0.05)",
                                  background: "rgba(255,255,255,0.012)",
                                }}
                              >
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                                  style={{ color: unlocked ? theme.primary : "rgba(255,255,255,0.2)" }}
                                >
                                  {unlocked ? <span className="text-xs font-black">✓</span> : <Lock className="h-3 w-3" />}
                                </div>
                                <span className="text-[9px] font-bold text-white/35">Lv {rung.level}</span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={rung.level}
                              className="flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all"
                              style={{
                                borderColor: unlocked ? `${theme.primary}40` : "rgba(255,255,255,0.05)",
                                background: unlocked
                                  ? `linear-gradient(160deg, ${theme.primary}1C, rgba(255,255,255,0.015))`
                                  : "rgba(255,255,255,0.015)",
                              }}
                            >
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl border text-xs"
                                style={{
                                  color: unlocked ? theme.accent : isNext ? theme.primary : "rgba(255,255,255,0.25)",
                                  borderColor: unlocked || isNext ? `${theme.primary}50` : "rgba(255,255,255,0.06)",
                                  background: unlocked || isNext ? `${theme.primary}18` : "rgba(255,255,255,0.02)",
                                  boxShadow: unlocked ? `0 0 10px ${theme.glow}` : "none",
                                }}
                              >
                                {unlocked ? (
                                  <span className="text-xs font-black">✓</span>
                                ) : rung.level - currentLevel > 3 ? (
                                  <Lock className="h-3 w-3" />
                                ) : (
                                  <RewardIcon rewardType={rung.reward.rewardType} className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <span className="text-[9px] font-black text-white/60">Lv {rung.level}</span>
                              <span className="text-[10px] font-black" style={{ color: unlocked ? theme.accent : "rgba(255,255,255,0.3)" }}>
                                +{rung.reward.rewardAmount.toLocaleString()}
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

  const ladder = useMemo(() => buildLadder(rewards, MAX_LEVEL), [rewards]);
  const sortedRewards = useMemo(() => [...rewards].sort((a, b) => a.level - b.level), [rewards]);
  const nextReward = sortedRewards.find((reward) => reward.level > currentLevel);
  const isMaxed = currentLevel >= MAX_LEVEL;

  // A short window of upcoming rungs around the player, reward or not —
  // this is what makes the ladder feel continuous instead of jumping
  // straight from level 10 to level 100.
  const nearbyLadder = useMemo(() => {
    const startLevel = Math.max(1, currentLevel - 1);
    return ladder.filter((r) => r.level >= startLevel).slice(0, 5);
  }, [ladder, currentLevel]);

  const theme = tierForLevel(Math.max(1, currentLevel));
  const levelsToGo = nextReward ? nextReward.level - currentLevel : 0;

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border p-5"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: `radial-gradient(circle at 100% 0%, ${theme.primary}18, #17131F 55%)` }}
    >
      <RewardsMotionStyles />

      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px]" style={{ background: `${theme.primary}26` }} />
      <Sparkle style={{ top: "12%", left: "78%", animationDelay: "0.2s" }} />
      <Sparkle style={{ top: "30%", left: "88%", animationDelay: "1s" }} />
      <Sparkle style={{ top: "6%", left: "60%", animationDelay: "1.6s" }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Prestige Path</p>
            <h2 className="mt-1 text-xl font-black text-[#F8F1E6]">Level Rewards</h2>
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider"
              style={{ color: theme.accent, borderColor: `${theme.primary}50`, background: `${theme.primary}18` }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {theme.name} · Lv {currentLevel}
            </span>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/35">
            {MAX_LEVEL} levels
          </span>
        </div>

        {/* Next reward / Max level hero */}
        {isMaxed ? (
          <div className="relative mt-5 overflow-hidden rounded-2xl p-[2px]">
            <div className="lr-max-border absolute inset-0" />
            <div className="relative flex items-center gap-3 rounded-[14px] bg-[#1B1424] px-4 py-4">
              <div className="lr-bob flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F5B93F]/25 to-[#FF6CA8]/25">
                <Crown className="h-6 w-6 text-[#F5B93F]" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#F5B93F]">Max Level Reached</p>
                <p className="mt-0.5 text-[11px] text-white/40">You've cleared all {MAX_LEVEL} levels</p>
              </div>
            </div>
          </div>
        ) : nextReward ? (
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
              style={{ background: tierForLevel(nextReward.level).glow }}
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
                      background: `linear-gradient(90deg, ${tierForLevel(nextReward.level).primary}, ${tierForLevel(nextReward.level).accent})`,
                    }}
                  />
                </div>
              </div>

              <div
                className="lr-pulse flex h-14 w-14 items-center justify-center rounded-2xl border text-lg"
                style={{
                  color: tierForLevel(nextReward.level).primary,
                  borderColor: `${tierForLevel(nextReward.level).primary}55`,
                  background: `linear-gradient(135deg, ${tierForLevel(nextReward.level).primary}28, ${tierForLevel(nextReward.level).primary}0A)`,
                  boxShadow: `0 0 22px ${tierForLevel(nextReward.level).glow}`,
                }}
              >
                <RewardIcon rewardType={nextReward.rewardType} className="h-6 w-6" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Nearby ladder strip */}
        {nearbyLadder.length > 0 && (
          <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2 pt-3">
            {nearbyLadder.map((rung) => (
              <LadderChip
                key={rung.level}
                rung={rung}
                unlocked={currentLevel >= rung.level}
                isCurrent={rung.level === currentLevel}
                isNext={rung.reward?.id === nextReward?.id}
              />
            ))}
          </div>
        )}

        {/* View all trigger */}
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-black uppercase tracking-wider transition-all hover:brightness-110"
          style={{ borderColor: `${theme.primary}45`, background: `linear-gradient(135deg, ${theme.primary}24, ${theme.primary}0A)`, color: theme.accent }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          View path to Level {MAX_LEVEL}
        </button>
      </div>

      {showAll && <AllRewardsModal ladder={ladder} currentLevel={currentLevel} onClose={() => setShowAll(false)} />}
    </section>
  );
}