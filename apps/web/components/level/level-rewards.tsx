"use client";

import type { LevelReward } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
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

export function LevelRewards({
  rewards,
  currentLevel,
}: LevelRewardsProps) {
  const sortedRewards = [...rewards].sort(
    (a, b) => a.level - b.level,
  );

  const nextReward = sortedRewards.find(
    (reward) => reward.level > currentLevel,
  );

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
              style={{
                background: getLevelTheme(
                  nextReward.level,
                ).glow,
              }}
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
                  {rewardLabel(
                    nextReward.rewardType,
                  )}{" "}
                  reward
                </p>
              </div>

              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border text-lg"
                style={{
                  color:
                    getLevelTheme(
                      nextReward.level,
                    ).primary,
                  borderColor:
                    `${getLevelTheme(nextReward.level).primary}40`,
                  background:
                    `${getLevelTheme(nextReward.level).primary}10`,
                }}
              >
                {rewardIcon(
                  nextReward.rewardType,
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="relative mt-6">
          {/* Vertical line */}
          <div className="absolute bottom-5 left-[23px] top-5 w-px bg-white/[0.07]" />

          <div className="space-y-3">
            {sortedRewards.map(
              (reward) => {
                const unlocked =
                  currentLevel >=
                  reward.level;

                const theme =
                  getLevelTheme(
                    reward.level,
                  );

                const isNext =
                  !unlocked &&
                  reward.id ===
                    nextReward?.id;

                return (
                  <div
                    key={reward.id}
                    className={[
                      "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
                      unlocked
                        ? "border-white/[0.08] bg-white/[0.025]"
                        : isNext
                          ? "border-white/[0.12] bg-white/[0.035]"
                          : "border-white/[0.05] bg-white/[0.015] opacity-70",
                    ].join(" ")}
                  >
                    {/* Reward glow */}
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl"
                      style={{
                        background:
                          theme.glow,
                        opacity:
                          unlocked
                            ? 0.22
                            : 0.08,
                      }}
                    />

                    <div className="relative flex items-center gap-4">
                      {/* Timeline icon */}
                      <div className="relative shrink-0">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                          style={{
                            color:
                              unlocked
                                ? theme.accent
                                : isNext
                                  ? theme.primary
                                  : "rgba(255,255,255,0.25)",

                            borderColor:
                              unlocked ||
                              isNext
                                ? `${theme.primary}45`
                                : "rgba(255,255,255,0.06)",

                            background:
                              unlocked ||
                              isNext
                                ? `${theme.primary}12`
                                : "rgba(255,255,255,0.025)",

                            boxShadow:
                              unlocked
                                ? `0 0 20px ${theme.glow}`
                                : "none",
                          }}
                        >
                          {unlocked ? (
                            <span className="text-sm font-black">
                              ✓
                            </span>
                          ) : (
                            <span className="text-base font-black">
                              {rewardIcon(
                                reward.rewardType,
                              )}
                            </span>
                          )}
                        </div>

                        {/* Level number */}
                        <div
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[8px] font-black"
                          style={{
                            borderColor:
                              unlocked
                                ? `${theme.primary}50`
                                : "rgba(255,255,255,0.08)",
                            background:
                              "#17131F",
                            color:
                              unlocked
                                ? theme.accent
                                : "rgba(255,255,255,0.35)",
                          }}
                        >
                          {reward.level}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">
                            {rewardLabel(
                              reward.rewardType,
                            )}
                          </span>

                          {unlocked && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
                              style={{
                                color:
                                  theme.accent,
                                background:
                                  `${theme.primary}15`,
                              }}
                            >
                              Unlocked
                            </span>
                          )}

                          {isNext && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
                              style={{
                                color:
                                  theme.accent,
                                background:
                                  `${theme.primary}15`,
                              }}
                            >
                              Next
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[11px] text-white/30">
                          Reach level{" "}
                          <span className="font-bold text-white/50">
                            {reward.level}
                          </span>{" "}
                          to unlock
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <div
                          className="text-lg font-black"
                          style={{
                            color:
                              unlocked
                                ? theme.accent
                                : "rgba(255,255,255,0.3)",
                            textShadow:
                              unlocked
                                ? `0 0 12px ${theme.glow}`
                                : "none",
                          }}
                        >
                          +
                          {reward.rewardAmount.toLocaleString()}
                        </div>

                        <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">
                          reward
                        </div>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Empty */}
        {sortedRewards.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <div className="text-2xl text-white/20">
              ✦
            </div>

            <p className="mt-3 text-sm font-bold text-white/40">
              No rewards yet
            </p>

            <p className="mt-1 text-xs text-white/20">
              More milestones are coming.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}