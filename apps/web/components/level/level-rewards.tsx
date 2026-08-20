import type { LevelReward } from "@/lib/api/levels";

interface LevelRewardsProps {
  rewards: LevelReward[];
  currentLevel: number;
}

export function LevelRewards({
  rewards,
  currentLevel,
}: LevelRewardsProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">
            Level rewards
          </h2>

          <p className="text-xs text-white/40">
            Rewards unlocked as you progress
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rewards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/40">
            No rewards configured yet.
          </div>
        ) : (
          rewards.map((reward) => {
            const unlocked =
              reward.level <= currentLevel;

            return (
              <div
                key={reward.id}
                className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                  unlocked
                    ? "border-purple-400/20 bg-purple-400/[0.06]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                      unlocked
                        ? "bg-purple-400/15 text-purple-200"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {reward.level}
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      {reward.rewardType}
                    </div>

                    <div className="text-xs text-white/40">
                      Level {reward.level}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {reward.rewardAmount.toLocaleString()}
                  </div>

                  <div className="text-[11px] text-white/35">
                    {unlocked
                      ? "Unlocked"
                      : "Locked"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}