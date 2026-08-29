"use client";

import type { LevelHistoryItem } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

interface LevelHistoryProps {
  history: LevelHistoryItem[];
}

function formatDate(value: string) {
  const date = new Date(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LevelCrown({
  color,
}: {
  color: string;
}) {
  return (
    <svg
      width="28"
      height="22"
      viewBox="0 0 28 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 5L7 13L14 3L21 13L26 5L24 19H4L2 5Z"
        fill={color}
        fillOpacity="0.95"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <circle
        cx="7"
        cy="13"
        r="1.5"
        fill="white"
        fillOpacity="0.75"
      />

      <circle
        cx="14"
        cy="3"
        r="1.8"
        fill="white"
        fillOpacity="0.9"
      />

      <circle
        cx="21"
        cy="13"
        r="1.5"
        fill="white"
        fillOpacity="0.75"
      />
    </svg>
  );
}

export function LevelHistory({
  history,
}: LevelHistoryProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#17131F] p-5">
      {/* Background aura */}
      <div className="pointer-events-none absolute -left-32 top-20 h-64 w-64 rounded-full bg-[#A86CFF]/10 blur-[100px]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Progression
            </p>

            <h2 className="mt-1 text-xl font-black text-[#F8F1E6]">
              Your Journey
            </h2>
          </div>

          {history.length > 0 && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-bold text-white/30">
              {history.length} milestones
            </span>
          )}
        </div>

        {/* Empty state */}
        {history.length === 0 ? (
          <div className="relative mt-6 overflow-hidden rounded-[26px] border border-white/[0.07] bg-gradient-to-br from-white/[0.025] to-transparent px-6 py-12 text-center">
            {/* Glow */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 rounded-full bg-[#A86CFF]/15 blur-3xl" />

            {/* Icon */}
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[#A86CFF]/20" />

              <div className="absolute inset-2 rounded-full border border-[#C99BFF]/10" />

              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#A86CFF]/10 text-[#C99BFF] shadow-[0_0_30px_rgba(168,108,255,0.2)]">
                <LevelCrown color="#C99BFF" />
              </div>
            </div>

            <h3 className="relative mt-5 text-base font-black text-white/70">
              Your story starts here
            </h3>

            <p className="relative mx-auto mt-2 max-w-[260px] text-xs leading-5 text-white/25">
              Earn XP, level up, and build a
              progression history worth showing
              off.
            </p>

            <div className="relative mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-[#A86CFF]/40 to-transparent" />
          </div>
        ) : (
          <div className="relative mt-7">
            {/* Main timeline */}
            <div className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-white/[0.12] via-white/[0.07] to-transparent" />

            <div className="space-y-4">
              {history.map((item, index) => {
                const theme = getLevelTheme(
                  item.newLevel,
                );

                const isLatest = index === 0;

                return (
                  <article
                    key={item.id}
                    className="group relative flex gap-4"
                  >
                    {/* Timeline node */}
                    <div className="relative z-10 shrink-0">
                      <div
                        className={[
                          "flex h-14 w-14 items-center justify-center rounded-[18px] border transition-all duration-300",
                          isLatest
                            ? "scale-105"
                            : "group-hover:scale-105",
                        ].join(" ")}
                        style={{
                          borderColor: `${theme.primary}50`,
                          background: `
                            radial-gradient(
                              circle at 50% 35%,
                              ${theme.primary}25,
                              transparent 65%
                            ),
                            #17131F
                          `,
                          boxShadow: isLatest
                            ? `
                              0 0 20px ${theme.glow},
                              inset 0 0 15px ${theme.glow}
                            `
                            : `0 0 10px ${theme.glow}`,
                        }}
                      >
                        <div className="text-center">
                          <div
                            className="text-base font-black leading-none"
                            style={{
                              color: theme.accent,
                              textShadow: `0 0 10px ${theme.glow}`,
                            }}
                          >
                            {item.newLevel}
                          </div>

                          <div
                            className="mt-1 text-[7px] font-black uppercase tracking-wider"
                            style={{
                              color: `${theme.accent}90`,
                            }}
                          >
                            LVL
                          </div>
                        </div>
                      </div>

                      {/* Crown */}
                      {item.newLevel >= 30 && (
                        <div
                          className="absolute -right-2 -top-4"
                          style={{
                            filter: `drop-shadow(0 0 6px ${theme.glow})`,
                          }}
                        >
                          <LevelCrown
                            color={theme.primary}
                          />
                        </div>
                      )}
                    </div>

                    {/* Card */}
                    <div
                      className={[
                        "relative min-w-0 flex-1 overflow-hidden rounded-[22px] border p-4 transition-all duration-300",
                        isLatest
                          ? "border-white/[0.12] bg-white/[0.035]"
                          : "border-white/[0.06] bg-white/[0.018] group-hover:border-white/[0.1]",
                      ].join(" ")}
                    >
                      {/* Level aura */}
                      <div
                        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl"
                        style={{
                          background: theme.glow,
                          opacity: isLatest
                            ? 0.22
                            : 0.08,
                        }}
                      />

                      <div className="relative">
                        {/* Top */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-black text-white">
                                Level{" "}
                                {item.newLevel}
                              </h3>

                              {isLatest && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.15em]"
                                  style={{
                                    color:
                                      theme.accent,
                                    background:
                                      `${theme.primary}15`,
                                    border:
                                      `1px solid ${theme.primary}25`,
                                  }}
                                >
                                  Latest
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-[11px] text-white/30">
                              Level{" "}
                              {item.oldLevel}{" "}
                              <span className="mx-1 text-white/15">
                                →
                              </span>
                              <span
                                className="font-bold"
                                style={{
                                  color:
                                    theme.accent,
                                }}
                              >
                                {item.newLevel}
                              </span>
                            </p>
                          </div>

                          <span className="shrink-0 text-[9px] text-white/20">
                            {formatDate(
                              item.createdAt,
                            )}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="my-3 h-px bg-white/[0.05]" />

                        {/* Bottom stats */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">
                              Experience
                            </p>

                            <p
                              className="mt-1 text-xs font-black"
                              style={{
                                color:
                                  theme.accent,
                                textShadow:
                                  isLatest
                                    ? `0 0 8px ${theme.glow}`
                                    : "none",
                              }}
                            >
                              {item.xpAtLevelUp.toLocaleString()}{" "}
                              XP
                            </p>
                          </div>

                          {/* Prestige badge */}
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl border"
                            style={{
                              borderColor:
                                `${theme.primary}30`,
                              background:
                                `${theme.primary}0D`,
                            }}
                          >
                            <LevelCrown
                              color={
                                theme.primary
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}