"use client";

import type { LevelReward } from "@/lib/api/levels";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
}

function rewardLabel(
  rewardType: string,
) {
  switch (rewardType.toLowerCase()) {
    case "coins":
      return "Coins";

    case "diamonds":
      return "Diamonds";

    default:
      return rewardType;
  }
}

function rewardSymbol(
  rewardType: string,
) {
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

  return (
    <section className="rounded-[30px] border border-white/[0.08] bg-[#1D1729] p-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D9A94A]/70">
            Milestones
          </p>

          <h2 className="mt-1 text-xl font-bold text-[#F8F1E6]">
            Level Rewards
          </h2>
        </div>

        <span className="text-xs text-white/30">
          {sortedRewards.length} rewards
        </span>
      </div>

      {/* Rewards */}
      <div className="mt-5 space-y-3">
        {sortedRewards.map(
          (reward, index) => {
            const unlocked =
              currentLevel >=
              reward.level;

            const isNext =
              !unlocked &&
              sortedRewards
                .slice(0, index)
                .every(
                  (item) =>
                    currentLevel >=
                    item.level,
                );

            return (
              <div
                key={reward.id}
                className={[
                  "group relative overflow-hidden rounded-2xl border p-4 transition-all",
                  unlocked
                    ? "border-[#D9A94A]/20 bg-[#D9A94A]/[0.06]"
                    : isNext
                      ? "border-[#A86CFF]/20 bg-[#A86CFF]/[0.05]"
                      : "border-white/[0.06] bg-white/[0.015]",
                ].join(" ")}
              >
                {unlocked && (
                  <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-[#D9A94A]/10 blur-2xl" />
                )}

                <div className="relative flex items-center gap-4">
                  {/* Reward icon */}
                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold",
                      unlocked
                        ? "bg-[#D9A94A]/15 text-[#E1B85A]"
                        : isNext
                          ? "bg-[#A86CFF]/15 text-[#C99BFF]"
                          : "bg-white/[0.04] text-white/25",
                    ].join(" ")}
                  >
                    {unlocked
                      ? "✓"
                      : rewardSymbol(
                          reward.rewardType,
                        )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F8F1E6]">
                        Level {reward.level}
                      </span>

                      {unlocked && (
                        <span className="rounded-full bg-[#D9A94A]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#D9A94A]">
                          Claimed
                        </span>
                      )}

                      {isNext && (
                        <span className="rounded-full bg-[#A86CFF]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#C99BFF]">
                          Next
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-white/35">
                      {rewardLabel(
                        reward.rewardType,
                      )}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p
                      className={[
                        "text-lg font-bold",
                        unlocked
                          ? "text-[#F8F1E6]"
                          : "text-white/30",
                      ].join(" ")}
                    >
                      +
                      {reward.rewardAmount.toLocaleString()}
                    </p>

                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      reward
                    </p>
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>

      {sortedRewards.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
          <p className="text-sm font-medium text-white/40">
            No rewards configured yet.
          </p>

          <p className="mt-1 text-xs text-white/20">
            More milestones are coming.
          </p>
        </div>
      )}
    </section>
  );
}