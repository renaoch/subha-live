"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Coins, Gem, Lock, Zap } from "lucide-react";

import type { LevelDefinitionItem, LevelProgress, LevelReward } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

/**
 * Coins a user must spend to earn 1 XP.
 * Leave as `null` until coin-spend → XP exists in the backend; the coin
 * lines are hidden so users never see a made-up number.
 */
export const COINS_PER_XP: number | null = null;

const PREVIEW_ROWS = 5;
const fmt = (n: number) => n.toLocaleString();

interface Props {
  progress: LevelProgress;
  definitions: LevelDefinitionItem[];
  rewards: LevelReward[];
}

function RewardPill({ reward, dim }: { reward?: LevelReward; dim?: boolean }) {
  if (!reward) return <span className="text-xs text-white/20">No reward</span>;
  const Icon = reward.rewardType.toLowerCase() === "diamonds" ? Gem : Coins;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
        dim ? "bg-white/[0.05] text-white/35" : "bg-amber-300/12 text-amber-300"
      }`}
    >
      <Icon className="h-3 w-3" />+{fmt(reward.rewardAmount)}
    </span>
  );
}

export function LevelRoadmap({ progress, definitions, rewards }: Props) {
  const [mode, setMode] = useState<"next" | "all">("next");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentRowRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => [...definitions].sort((a, b) => a.level - b.level), [definitions]);
  const rewardByLevel = useMemo(() => new Map(rewards.map((r) => [r.level, r])), [rewards]);

  const isMax = progress.nextLevel === null;
  const next = sorted.find((d) => d.level === progress.nextLevel);
  const theme = getLevelTheme(progress.nextLevel ?? progress.currentLevel);

  const xpToNext = next ? Math.max(0, next.xpRequired - progress.totalXp) : 0;
  const nextReward = next ? rewardByLevel.get(next.level) : undefined;
  const nextRewardLevel = useMemo(
    () => rewards.filter((r) => r.level > progress.currentLevel).sort((a, b) => a.level - b.level)[0],
    [rewards, progress.currentLevel],
  );

  const rows = useMemo(() => {
    if (mode === "all") return sorted;
    const current = sorted.find((d) => d.level === progress.currentLevel);
    const upcoming = sorted.filter((d) => d.level > progress.currentLevel).slice(0, PREVIEW_ROWS);
    return [...(current ? [current] : []), ...upcoming];
  }, [mode, sorted, progress.currentLevel]);

  // Jump to the player's row when the full list opens (without moving the page).
  useEffect(() => {
    if (mode !== "all") return;
    const box = scrollerRef.current;
    const row = currentRowRef.current;
    if (box && row) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2);
  }, [mode]);

  if (sorted.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Next level card */}
      {!isMax && next && (
        <div
          className="relative overflow-hidden rounded-[24px] border p-4"
          style={{
            borderColor: `${theme.primary}40`,
            background: `linear-gradient(135deg, ${theme.primary}1F, #14111C 62%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
                boxShadow: `0 10px 30px -8px ${theme.primary}`,
                color: "#120E19",
              }}
            >
              <span className="text-[10px] font-bold leading-none opacity-70">Level</span>
              <span className="text-[28px] font-black leading-none tabular-nums tracking-tight">{next.level}</span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{next.title ?? `Level ${next.level}`}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/60">
                <Zap className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                <span className="font-bold tabular-nums text-white">{fmt(xpToNext)} XP</span> away
                {COINS_PER_XP !== null && (
                  <span className="text-white/40">
                    {" "}
                    (about {fmt(Math.ceil(xpToNext * COINS_PER_XP))} coins)
                  </span>
                )}
              </p>
              <div className="mt-2">
                {nextReward ? (
                  <div className="flex items-center gap-2 text-xs text-white/55">
                    Reward <RewardPill reward={nextReward} />
                  </div>
                ) : nextRewardLevel ? (
                  <p className="text-xs text-white/45">
                    Next reward at Level {nextRewardLevel.level}, {nextRewardLevel.level - progress.currentLevel} levels away
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="rounded-[24px] border border-white/[0.08] bg-[#14111C] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">XP needed per level</h3>
            <p className="mt-0.5 text-xs text-white/40">Every level, its cost, its reward.</p>
          </div>
          <div className="flex rounded-full bg-white/[0.06] p-0.5 text-xs font-bold" role="tablist">
            {(["next", "all"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className="rounded-full px-3 py-1.5 transition-colors"
                style={
                  mode === m
                    ? { background: theme.primary, color: "#120E19" }
                    : { color: "rgba(255,255,255,0.5)" }
                }
              >
                {m === "next" ? "Next 5" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.06]">
          <div className="grid grid-cols-[1fr_auto_88px] gap-3 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/40">
            <span>Level</span>
            <span className="text-right">XP to climb</span>
            <span className="text-right">Reward</span>
          </div>

          <div
            ref={scrollerRef}
            className={`relative ${mode === "all" ? "max-h-[360px] overflow-y-auto overscroll-contain" : ""}`}
          >
            {rows.map((d) => {
              const idx = sorted.findIndex((x) => x.level === d.level);
              const step = idx > 0 ? d.xpRequired - sorted[idx - 1].xpRequired : d.xpRequired;
              const done = d.level < progress.currentLevel;
              const isCurrent = d.level === progress.currentLevel;
              const isNext = d.level === progress.nextLevel;
              const t = getLevelTheme(d.level);

              return (
                <div
                  key={d.level}
                  ref={isCurrent ? currentRowRef : undefined}
                  className="grid grid-cols-[1fr_auto_88px] items-center gap-3 border-t border-white/[0.05] px-3.5 py-3"
                  style={{
                    background: isNext ? `${t.primary}14` : isCurrent ? "rgba(255,255,255,0.035)" : undefined,
                    boxShadow: isNext ? `inset 3px 0 0 ${t.primary}` : undefined,
                    opacity: done ? 0.5 : 1,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black tabular-nums"
                      style={
                        isCurrent
                          ? { background: t.primary, color: "#120E19" }
                          : isNext
                            ? { border: `2px solid ${t.primary}`, color: t.accent }
                            : done
                              ? { background: `${t.primary}22`, color: t.primary }
                              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }
                      }
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : d.level}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {done ? `Level ${d.level}` : d.title ?? `Level ${d.level}`}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {isCurrent ? "You are here" : isNext ? "Next up" : done ? "Cleared" : `Level ${d.level}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-white">{fmt(step)}</p>
                    <p className="text-[11px] tabular-nums text-white/35">
                      {COINS_PER_XP !== null ? `≈ ${fmt(Math.ceil(step * COINS_PER_XP))} coins` : `${fmt(d.xpRequired)} total`}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    {!done && !isCurrent && !isNext && !rewardByLevel.get(d.level) ? (
                      <Lock className="h-3.5 w-3.5 text-white/15" />
                    ) : (
                      <RewardPill reward={rewardByLevel.get(d.level)} dim={done} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}