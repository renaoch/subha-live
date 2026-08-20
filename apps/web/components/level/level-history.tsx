import type { LevelHistoryItem } from "@/lib/api/levels";

interface LevelHistoryProps {
  history: LevelHistoryItem[];
}

export function LevelHistory({
  history,
}: LevelHistoryProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold">
          Level history
        </h2>

        <p className="text-xs text-white/40">
          Your recent level-ups
        </p>
      </div>

      <div className="space-y-2">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/40">
            No level-ups yet.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div>
                <div className="text-sm font-medium">
                  Level {item.oldLevel} → Level{" "}
                  {item.newLevel}
                </div>

                <div className="mt-1 text-xs text-white/35">
                  {new Date(
                    item.createdAt,
                  ).toLocaleDateString()}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold">
                  {item.xpAtLevelUp.toLocaleString()} XP
                </div>

                <div className="text-[11px] text-white/35">
                  Level up
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}