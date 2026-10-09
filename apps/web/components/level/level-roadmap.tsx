"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Coins, Crown, Gem, Lock, Sparkles, Zap } from "lucide-react";

import type { LevelDefinitionItem, LevelProgress, LevelReward } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

/**
 * Coins a user must spend to earn 1 XP.
 * Set this to the real conversion once coin-spend → XP is wired in the
 * backend. While it is `null`, the coins column is hidden so users are
 * never shown a made-up number.
 */
export const COINS_PER_XP: number | null = null;

const COLLAPSED_ROWS = 6;

interface Props {
  progress: LevelProgress;
  definitions: LevelDefinitionItem[];
  rewards: LevelReward[];
}

const fmt = (n: number) => n.toLocaleString();

function RewardTag({ reward }: { reward?: LevelReward }) {
  if (!reward) return <span className="text-white/20">—</span>;
  const isDiamond = reward.rewardType.toLowerCase() === "diamonds";
  const Icon = isDiamond ? Gem : Coins;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
      <Icon className="h-3 w-3" />+{fmt(reward.rewardAmount)}
    </span>
  );
}

export function LevelRoadmap({ progress, definitions, rewards }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showCoins = COINS_PER_XP !== null;

  const rewardByLevel = useMemo(() => new Map(rewards.map((r) => [r.level, r])), [rewards]);
  const sorted = useMemo(() => [...definitions].sort((a, b) => a.level - b.level), [definitions]);

  const isMax = progress.nextLevel === null;
  const next = sorted.find((d) => d.level === progress.nextLevel);
  const xpToNext = isMax || !next ? 0 : Math.max(0, next.xpRequired - progress.totalXp);
  const coinsToNext = COINS_PER_XP ? Math.ceil(xpToNext * COINS_PER_XP) : null;
  const theme = getLevelTheme(progress.nextLevel ?? progress.currentLevel);

  const rows = useMemo(() => {
    const upcoming = sorted.filter((d) => d.level > progress.currentLevel);
    const current = sorted.find((d) => d.level === progress.currentLevel);
    const base = expanded ? sorted : [...(current ? [current] : []), ...upcoming.slice(0, COLLAPSED_ROWS - 1)];
    return base;
  }, [sorted, progress.currentLevel, expanded]);

  if (sorted.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#15111D] p-5">
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-[90px]"
        style={{ background: theme.glow, opacity: 0.25 }}
      />

      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Roadmap</p>
        <h2 className="mt-1 text-xl font-black text-[#F8F1E6]">What it takes to level up</h2>

        {/* Next-level requirement call-out */}
        {!isMax && next && (
          <div
            className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border"
            style={{ borderColor: `${theme.primary}40`, background: `${theme.primary}20` }}
          >
            <div className="bg-[#1A1424] p-4">
              <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35">
                <Zap className="h-3 w-3" style={{ color: theme.primary }} /> XP needed
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: theme.accent }}>
                {fmt(xpToNext)}
              </p>
              <p className="text-[10px] text-white/30">to reach Lv {next.level}</p>
            </div>
            <div className="bg-[#1A1424] p-4">
              {showCoins && coinsToNext !== null ? (
                <>
                  <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35">
                    <Coins className="h-3 w-3 text-amber-300" /> Coins to spend
                  </p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-amber-300">{fmt(coinsToNext)}</p>
                  <p className="text-[10px] text-white/30">≈ {COINS_PER_XP} coin = 1 XP</p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35">
                    <Sparkles className="h-3 w-3" style={{ color: theme.primary }} /> Next title
                  </p>
                  <p className="mt-1 truncate text-lg font-black text-white">{next.title ?? `Level ${next.level}`}</p>
                  <p className="text-[10px] text-white/30">unlocks at Lv {next.level}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07]">
          <div
            className={`grid ${showCoins ? "grid-cols-[44px_1fr_1fr_1fr_64px]" : "grid-cols-[44px_1fr_1fr_64px]"} gap-2 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/35`}
          >
            <span>Lv</span>
            <span className="text-right">XP needed</span>
            {showCoins && <span className="text-right">Coins</span>}
            <span className="text-right">Total XP</span>
            <span className="text-right">Reward</span>
          </div>

          <div className={expanded ? "max-h-[420px] overflow-y-auto" : ""}>
            {rows.map((d) => {
              const prev = sorted[sorted.findIndex((x) => x.level === d.level) - 1];
              const step = prev ? d.xpRequired - prev.xpRequired : d.xpRequired;
              const done = d.level < progress.currentLevel;
              const isCurrent = d.level === progress.currentLevel;
              const isNext = d.level === progress.nextLevel;
              const t = getLevelTheme(d.level);

              return (
                <div
                  key={d.level}
                  className={`grid ${showCoins ? "grid-cols-[44px_1fr_1fr_1fr_64px]" : "grid-cols-[44px_1fr_1fr_64px]"} items-center gap-2 border-t border-white/[0.05] px-3 py-3 text-xs tabular-nums ${
                    isNext ? "bg-white/[0.05]" : isCurrent ? "bg-white/[0.025]" : ""
                  }`}
                  style={isNext ? { boxShadow: `inset 3px 0 0 ${t.primary}` } : undefined}
                >
                  <span className="flex items-center gap-1 font-black" style={{ color: done || isCurrent ? t.accent : isNext ? t.primary : "rgba(255,255,255,0.4)" }}>
                    {done ? <Check className="h-3 w-3" /> : !isCurrent && !isNext ? <Lock className="h-2.5 w-2.5 opacity-60" /> : null}
                    {d.level}
                  </span>
                  <span className={`text-right font-bold ${done ? "text-white/30 line-through decoration-white/20" : "text-white/80"}`}>
                    {fmt(step)}
                  </span>
                  {showCoins && (
                    <span className="text-right font-bold text-amber-300/80">{fmt(Math.ceil(step * (COINS_PER_XP ?? 0)))}</span>
                  )}
                  <span className="text-right text-white/40">{fmt(d.xpRequired)}</span>
                  <span className="text-right"><RewardTag reward={rewardByLevel.get(d.level)} /></span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[11px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/[0.07]"
        >
          {expanded ? "Show less" : `See all ${sorted.length} levels`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {isMax && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold text-amber-300">
            <Crown className="h-3.5 w-3.5" /> You've reached the top.
          </p>
        )}
      </div>
    </section>
  );
}