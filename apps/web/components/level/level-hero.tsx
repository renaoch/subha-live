"use client";

import { useEffect, useId, useState } from "react";

import type { LevelProgress } from "@/lib/api/levels";
import { getLevelTheme } from "./level-theme";

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 100;
const STROKE = 10;
const CIRC = 2 * Math.PI * RADIUS;
const TICKS = 60;
const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

interface LevelHeroProps {
  progress: LevelProgress;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function LevelHero({ progress }: LevelHeroProps) {
  const theme = getLevelTheme(progress.currentLevel);
  const gid = useId().replace(/:/g, "");

  const isMax = progress.nextLevel === null;
  const range = isMax ? 1 : Math.max(1, (progress.nextLevelXp ?? 0) - progress.currentLevelXp);
  const pct = isMax ? 100 : clamp(((progress.totalXp - progress.currentLevelXp) / range) * 100);
  const xpToNext = isMax ? 0 : Math.max(0, (progress.nextLevelXp ?? 0) - progress.totalXp);

  // Start empty, then fill once on mount: the one orchestrated moment.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const digits = String(progress.currentLevel).length;
  const numeralSize = digits <= 2 ? 92 : digits === 3 ? 72 : 56;
  const almostThere = !isMax && pct >= 80;

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-white/[0.08] px-5 pb-6 pt-5"
      style={{
        background: `radial-gradient(110% 70% at 50% 0%, ${theme.primary}2E, transparent 62%), #14111C`,
        boxShadow: `0 24px 60px -20px ${theme.primary}40`,
      }}
    >
      <style>{`
        @keyframes lh-spark { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:1; transform:scale(1.5) } }
        .lh-spark { transform-box: fill-box; transform-origin: center; animation: lh-spark 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .lh-spark { animation: none } .lh-anim { transition: none !important } }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-white/45">Your rank</p>
          <h2 className="text-xl font-extrabold tracking-tight text-white">{theme.tierName}</h2>
        </div>
        <span
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ color: theme.accent, borderColor: `${theme.primary}55`, background: `${theme.primary}14` }}
        >
          {progress.currentTitle ?? theme.frameName}
        </span>
      </div>

      {/* Progress ring */}
      <div className="relative mx-auto mt-5" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label={`Level ${progress.currentLevel}, ${Math.round(pct)} percent to the next level`}>
          <defs>
            <linearGradient id={`${gid}-arc`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={theme.primary} />
              <stop offset="100%" stopColor={theme.accent} />
            </linearGradient>
            <radialGradient id={`${gid}-disc`} cx="50%" cy="38%" r="70%">
              <stop offset="0%" stopColor={theme.primary} stopOpacity="0.22" />
              <stop offset="100%" stopColor="#100D17" stopOpacity="1" />
            </radialGradient>
            <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* Tick marks light up as you climb */}
          {Array.from({ length: TICKS }, (_, i) => {
            const angle = (i * 360) / TICKS;
            const major = i % 5 === 0;
            const lit = angle <= (shown / 100) * 360 && shown > 0;
            const r1 = RADIUS + 11;
            const r2 = RADIUS + (major ? 19 : 15);
            const rad = ((angle - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={CENTER + r1 * Math.cos(rad)}
                y1={CENTER + r1 * Math.sin(rad)}
                x2={CENTER + r2 * Math.cos(rad)}
                y2={CENTER + r2 * Math.sin(rad)}
                stroke={lit ? theme.secondary : "rgba(255,255,255,0.14)"}
                strokeWidth={major ? 2 : 1.25}
                strokeLinecap="round"
                className="lh-anim"
                style={{ transition: `stroke 0.4s ${EASE} ${(i / TICKS) * 1.2}s` }}
              />
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={RADIUS - STROKE / 2 - 4} fill={`url(#${gid}-disc)`} />
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />

          {/* Glow underlay + arc */}
          {[true, false].map((blur) => (
            <circle
              key={String(blur)}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={blur ? theme.primary : `url(#${gid}-arc)`}
              strokeOpacity={blur ? 0.7 : 1}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              filter={blur ? `url(#${gid}-glow)` : undefined}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className="lh-anim"
              style={{
                strokeDashoffset: CIRC * (1 - Math.max(shown, isMax ? 0 : 0.8) / 100),
                transition: `stroke-dashoffset 1.6s ${EASE}`,
              }}
            />
          ))}

          {/* Spark at the tip of the arc */}
          {!isMax && (
            <g
              className="lh-anim"
              style={{
                transform: `rotate(${(Math.max(shown, 0.8) / 100) * 360}deg)`,
                transformOrigin: `${CENTER}px ${CENTER}px`,
                transition: `transform 1.6s ${EASE}`,
              }}
            >
              <circle cx={CENTER} cy={CENTER - RADIUS} r={7} fill={theme.accent} className="lh-spark" opacity="0.5" />
              <circle cx={CENTER} cy={CENTER - RADIUS} r={4} fill="#fff" />
            </g>
          )}
        </svg>

        {/* Level numeral */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-medium text-white/45">Level</span>
          <span
            className="font-black leading-none tabular-nums text-white"
            style={{ fontSize: numeralSize, letterSpacing: "-0.05em", textShadow: `0 0 32px ${theme.primary}80` }}
          >
            {progress.currentLevel}
          </span>
          {!isMax && (
            <span className="mt-1 text-sm font-bold tabular-nums" style={{ color: theme.secondary }}>
              {Math.floor(pct)}%
            </span>
          )}
        </div>
      </div>

      {/* The number that pulls people forward */}
      <div className="mt-5 text-center">
        {isMax ? (
          <>
            <p className="text-2xl font-extrabold text-white">You're at the top</p>
            <p className="mt-1 text-sm text-white/45">Nobody ranks higher than you.</p>
          </>
        ) : (
          <>
            <p className="text-[38px] font-black leading-none tracking-tight tabular-nums text-white">
              {xpToNext.toLocaleString()} <span className="text-lg font-bold text-white/45">XP to go</span>
            </p>
            <p className="mt-2 text-sm text-white/55">
              until <span className="font-bold text-white">Level {progress.nextLevel}</span>
              {progress.nextTitle ? <>, and you become {progress.nextTitle}</> : null}
            </p>
            {almostThere && (
              <p
                className="mx-auto mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: `${theme.primary}22`, color: theme.accent }}
              >
                Almost there, only {Math.max(1, Math.round(100 - pct))}% left
              </p>
            )}
          </>
        )}
      </div>

      {/* Stats */}
      <dl className="mt-5 grid grid-cols-2 divide-x divide-white/[0.08] rounded-2xl border border-white/[0.07] bg-black/20 py-3">
        <div className="px-4">
          <dt className="text-xs text-white/40">Total XP</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{progress.totalXp.toLocaleString()}</dd>
        </div>
        <div className="px-4">
          <dt className="text-xs text-white/40">{isMax ? "Status" : "This level"}</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums text-white">
            {isMax ? "Maxed" : `${Math.max(0, progress.totalXp - progress.currentLevelXp).toLocaleString()} / ${range.toLocaleString()}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}