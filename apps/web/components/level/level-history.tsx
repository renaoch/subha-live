"use client";

import type { LevelHistoryItem } from "@/lib/api/levels";

interface LevelHistoryProps {
  history: LevelHistoryItem[];
}

function formatDate(
  value: string,
) {
  const date = new Date(value);

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

export function LevelHistory({
  history,
}: LevelHistoryProps) {
  return (
    <section className="rounded-[30px] border border-white/[0.08] bg-[#1D1729] p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C99BFF]/70">
          Your journey
        </p>

        <h2 className="mt-1 text-xl font-bold text-[#F8F1E6]">
          Level History
        </h2>
      </div>

      {history.length === 0 ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#A86CFF]/10 text-xl text-[#C99BFF]">
            ✦
          </div>

          <h3 className="mt-4 text-sm font-semibold text-white/60">
            Your journey starts here
          </h3>

          <p className="mx-auto mt-2 max-w-[240px] text-xs leading-5 text-white/25">
            Keep completing tasks and
            activities to earn XP and
            unlock new levels.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          {history.map(
            (item, index) => {
              const isLast =
                index ===
                history.length - 1;

              return (
                <div
                  key={item.id}
                  className="relative flex gap-4"
                >
                  {/* Timeline */}
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#D9A94A]/25 bg-[#D9A94A]/10 text-xs font-bold text-[#D9A94A]">
                      ↑
                    </div>

                    {!isLast && (
                      <div className="w-px flex-1 bg-gradient-to-b from-[#D9A94A]/30 to-white/[0.04]" />
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className={[
                      "flex-1",
                      isLast
                        ? "pb-1"
                        : "pb-6",
                    ].join(" ")}
                  >
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#F8F1E6]">
                            Level{" "}
                            {item.newLevel}
                          </p>

                          <p className="mt-1 text-xs text-white/35">
                            Level{" "}
                            {item.oldLevel}{" "}
                            →{" "}
                            {item.newLevel}
                          </p>
                        </div>

                        <span className="text-[10px] text-white/25">
                          {formatDate(
                            item.createdAt,
                          )}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                        <span className="text-[10px] uppercase tracking-wider text-white/25">
                          XP at level up
                        </span>

                        <span className="text-xs font-bold text-[#D9A94A]">
                          {item.xpAtLevelUp.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}