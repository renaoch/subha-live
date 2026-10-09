"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";

import type { LevelProgress } from "@/lib/api/levels";
import { getLevelTheme, type LevelTheme } from "./level-theme";

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 100;
const STROKE = 10;
const CIRC = 2 * Math.PI * RADIUS;
const TICKS = 60;
const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";
const LAST_LEVEL_KEY = "subha:last-level-seen";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useCountUp(target: number, ms = 1400, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Crown                                                               */
/* ------------------------------------------------------------------ */

type CrownType = "small" | "royal" | "winged" | "celestial";

const BODY = "M40 74 L31 34 L54 52 L70 18 L86 52 L109 34 L100 74 Z";
const FEATHERS = [
  "M40 64 C 22 60, 6 46, 4 22 C 16 29, 30 42, 42 56 Z",
  "M40 68 C 24 68, 10 60, 5 44 C 18 47, 30 56, 42 62 Z",
  "M40 72 C 28 75, 15 71, 9 61 C 20 61, 30 66, 42 68 Z",
];
const STAR = "M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z";

function CrownArt({ type, theme, id }: { type: CrownType; theme: LevelTheme; id: string }) {
  const wings = type === "winged" || type === "celestial";
  const gems = type !== "small";
  const celestial = type === "celestial";

  return (
    <svg viewBox="0 0 140 96" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} />
          <stop offset="55%" stopColor={theme.primary} />
          <stop offset="100%" stopColor={theme.secondary} />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} />
          <stop offset="100%" stopColor={theme.primary} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BODY} />
          <rect x="38" y="70" width="64" height="12" rx="5" />
        </clipPath>
      </defs>

      {/* wings */}
      {wings &&
        [false, true].map((mirror) => (
          <g key={String(mirror)} transform={mirror ? "translate(140 0) scale(-1 1)" : undefined}>
            <g className="lh-wing">
              {FEATHERS.map((d, i) => (
                <path key={i} d={d} fill={`url(#${id}-wing)`} stroke={theme.secondary} strokeOpacity="0.55" strokeWidth="1" strokeLinejoin="round" />
              ))}
            </g>
          </g>
        ))}

      {/* halo */}
      {celestial && (
        <ellipse cx="70" cy="6" rx="21" ry="4.5" fill="none" stroke={theme.accent} strokeWidth="2" className="lh-halo" />
      )}

      {/* body */}
      <path d={BODY} fill={`url(#${id}-body)`} stroke={theme.accent} strokeWidth="2" strokeLinejoin="round" />
      <rect x="38" y="70" width="64" height="12" rx="5" fill={theme.primary} stroke={theme.accent} strokeWidth="1.5" />
      <path d="M70 24 L60 52 L70 46 Z" fill="#fff" opacity="0.22" />

      {/* sheen sweeping across the metal */}
      <g clipPath={`url(#${id}-clip)`}>
        <g className="lh-crown-shine">
          <rect x="-30" y="0" width="26" height="96" fill={`url(#${id}-shine)`} transform="skewX(-20)" />
        </g>
      </g>

      {/* jewels */}
      {gems &&
        [52, 70, 88].map((cx) => <circle key={cx} cx={cx} cy={76} r={2.8} fill="#fff" opacity="0.9" />)}
      {[
        [31, 34, 4.5],
        [70, 18, celestial ? 7 : 5.5],
        [109, 34, 4.5],
      ].map(([cx, cy, r]) => (
        <g key={`${cx}`}>
          <circle cx={cx} cy={cy} r={r + 3} fill={theme.accent} opacity="0.35" className="lh-gem" />
          <circle cx={cx} cy={cy} r={r} fill="#fff" />
        </g>
      ))}

      {celestial &&
        [
          [22, 20, 0],
          [118, 18, 0.8],
          [6, 58, 1.5],
          [134, 56, 0.4],
        ].map(([x, y, d]) => (
          <path key={`${x}${y}`} d={STAR} transform={`translate(${x} ${y})`} fill="#fff" className="lh-twinkle-star" style={{ animationDelay: `${d}s` }} />
        ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Burst (one-shot celebration)                                        */
/* ------------------------------------------------------------------ */

function Burst({ theme, count = 28, delay = 0 }: { theme: LevelTheme; count?: number; delay?: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden>
      <div className="lh-burst-ring" style={{ borderColor: theme.accent, animationDelay: `${delay}s` }} />
      {Array.from({ length: count }, (_, i) => {
        const a = (360 / count) * i;
        const long = i % 2 === 0;
        return (
          <span
            key={i}
            className="lh-shoot"
            style={
              {
                "--a": `${a}deg`,
                "--d": `${long ? 150 : 105}px`,
                width: long ? 3 : 2,
                height: long ? 16 : 10,
                background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? theme.accent : theme.secondary,
                animationDelay: `${delay}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

interface LevelHeroProps {
  progress: LevelProgress;
}

export function LevelHero({ progress }: LevelHeroProps) {
  const theme = getLevelTheme(progress.currentLevel);
  const gid = useId().replace(/:/g, "");

  const isMax = progress.nextLevel === null;
  const range = isMax ? 1 : Math.max(1, (progress.nextLevelXp ?? 0) - progress.currentLevelXp);
  const pct = isMax ? 100 : clamp(((progress.totalXp - progress.currentLevelXp) / range) * 100);
  const xpToNext = isMax ? 0 : Math.max(0, (progress.nextLevelXp ?? 0) - progress.totalXp);

  /* ---- power: everything below scales with how high you've climbed ---- */
  const tierIdx = Math.min(9, Math.floor((Math.max(1, progress.currentLevel) - 1) / 10)); // 0..9
  const power = isMax ? 1 : tierIdx / 9; // 0..1
  const crownType: CrownType | null = isMax ? "celestial" : theme.crown === "none" ? null : theme.crown;
  const crownWidth = { small: 78, royal: 104, winged: 136, celestial: 168 }[crownType ?? "small"];
  const crownTop = { small: 40, royal: 58, winged: 80, celestial: 104 }[crownType ?? "small"];

  const orbitCount = isMax ? 12 : tierIdx < 1 ? 0 : Math.round(2 + tierIdx * 0.9);
  const outerOrbit = isMax || tierIdx >= 6;
  const emberCount = isMax ? 26 : Math.round(tierIdx * 2);
  const pulseRings = isMax ? 3 : tierIdx >= 6 ? 2 : tierIdx >= 3 ? 1 : 0;
  const rays = isMax || tierIdx >= 2;
  const sweepRing = isMax || tierIdx >= 2;
  const fancyBorder = isMax || tierIdx >= 5;
  const charging = !isMax && pct >= 80;

  // ring fill: the one orchestrated page-open moment
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  // count-ups
  const levelShown = useCountUp(progress.currentLevel, 1100);
  const xpShown = useCountUp(xpToNext, 1500, 200);
  const totalShown = useCountUp(progress.totalXp, 1700, 200);

  // level-up celebration (compares with the last level this device saw)
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const prev = Number(localStorage.getItem(LAST_LEVEL_KEY) ?? 0);
      if (prev > 0 && progress.currentLevel > prev) {
        setCelebrate(true);
        timer = setTimeout(() => setCelebrate(false), 5200);
      }
      localStorage.setItem(LAST_LEVEL_KEY, String(progress.currentLevel));
    } catch {
      /* storage unavailable: skip celebration */
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [progress.currentLevel]);

  /* ---- deterministic particles (no hydration mismatch) ---- */
  const embers = useMemo(() => {
    const r = rng(progress.currentLevel * 97 + 13);
    return Array.from({ length: emberCount }, (_, i) => {
      const dur = 4 + r() * 5;
      return {
        left: 3 + r() * 94,
        size: 2 + r() * 3,
        dur,
        delay: -r() * dur,
        dx: (r() - 0.5) * 60,
        color: i % 3 === 0 ? "#fff" : i % 3 === 1 ? theme.accent : theme.secondary,
      };
    });
  }, [emberCount, progress.currentLevel, theme.accent, theme.secondary]);

  const innerDots = useMemo(() => {
    const r = rng(progress.currentLevel * 31 + 7);
    return Array.from({ length: orbitCount }, (_, i) => ({
      a: (360 / Math.max(1, orbitCount)) * i,
      s: 3 + r() * 3,
      star: isMax && i % 3 === 0,
    }));
  }, [orbitCount, progress.currentLevel, isMax]);

  const outerDots = useMemo(
    () => {
      if (!outerOrbit) return [];
      const n = isMax ? 8 : 4;
      return Array.from({ length: n }, (_, i) => ({ a: (360 / n) * i + 20, s: 2.5 + (i % 3) }));
    },
    [outerOrbit, isMax],
  );

  const digits = String(progress.currentLevel).length;
  const numeralSize = digits <= 2 ? 92 : digits === 3 ? 72 : 56;
  const shiny = power >= 0.3;
  const vars = {
    "--lh-p": theme.primary,
    "--lh-s": theme.secondary,
    "--lh-a": theme.accent,
  } as CSSProperties;

  return (
    <div
      className={fancyBorder ? "lh-border" : ""}
      style={{
        ...vars,
        padding: 1.5,
        borderRadius: 30,
        background: fancyBorder ? undefined : "rgba(255,255,255,0.08)",
        boxShadow: `0 24px 70px -18px ${theme.primary}${isMax ? "99" : "55"}`,
      }}
    >
      <section
        className="lh-fx relative overflow-hidden rounded-[28.5px] px-5 pb-6 pt-5"
        style={{ background: `radial-gradient(110% 70% at 50% 0%, ${theme.primary}${isMax ? "3D" : "2A"}, transparent 62%), #14111C` }}
      >
        <style>{CSS}</style>

        {/* rising embers across the whole card */}
        {embers.map((e, i) => (
          <span
            key={i}
            className="lh-ember"
            style={
              {
                left: `${e.left}%`,
                width: e.size,
                height: e.size,
                background: e.color,
                boxShadow: `0 0 ${e.size * 3}px ${e.color}`,
                animationDuration: `${e.dur}s`,
                animationDelay: `${e.delay}s`,
                "--dx": `${e.dx}px`,
              } as CSSProperties
            }
          />
        ))}

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-white/45">Your rank</p>
            <h2 className="text-xl font-extrabold tracking-tight text-white">{theme.tierName}</h2>
          </div>
          <span
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{ color: theme.accent, borderColor: `${theme.primary}66`, background: `${theme.primary}1A` }}
          >
            {progress.currentTitle ?? theme.frameName}
          </span>
        </div>

        {/* Ring stage */}
        <div className="relative mx-auto" style={{ width: SIZE, height: SIZE, maxWidth: "100%", marginTop: crownType ? crownTop : 20 }}>
          {/* god rays */}
          {rays && (
            <div
              className="lh-rays"
              style={{
                opacity: isMax ? 0.34 : 0.06 + power * 0.2,
                background: `repeating-conic-gradient(from 0deg, ${theme.accent} 0deg 5deg, transparent 5deg 15deg)`,
              }}
            />
          )}

          {/* pulse waves */}
          {Array.from({ length: pulseRings }, (_, i) => (
            <span key={i} className="lh-wave" style={{ borderColor: theme.secondary, animationDelay: `${i * 1.2}s` }} />
          ))}

          {/* orbits */}
          {orbitCount > 0 && (
            <div className="lh-orbit" style={{ animationDuration: isMax ? "12s" : "18s" }}>
              {innerDots.map((d, i) => (
                <span
                  key={i}
                  className="lh-dot"
                  style={{
                    width: d.s,
                    height: d.s,
                    background: i % 2 ? theme.accent : "#fff",
                    boxShadow: `0 0 ${d.s * 3}px ${theme.accent}`,
                    borderRadius: d.star ? 1 : 999,
                    transform: `rotate(${d.a}deg) translateY(-134px) ${d.star ? "rotate(45deg)" : ""}`,
                  }}
                />
              ))}
            </div>
          )}
          {outerOrbit && (
            <div className="lh-orbit lh-orbit-rev" style={{ animationDuration: "24s" }}>
              {outerDots.map((d, i) => (
                <span
                  key={i}
                  className="lh-dot"
                  style={{
                    width: d.s,
                    height: d.s,
                    background: theme.secondary,
                    boxShadow: `0 0 ${d.s * 3}px ${theme.secondary}`,
                    borderRadius: 999,
                    transform: `rotate(${d.a}deg) translateY(-156px)`,
                  }}
                />
              ))}
            </div>
          )}

          {/* travelling light on the ring */}
          {sweepRing && (
            <div
              className="lh-sweep"
              style={{ background: `conic-gradient(from 0deg, transparent 0 62%, ${theme.secondary} 90%, #fff 100%)`, animationDuration: isMax ? "2.6s" : "4.5s" }}
            />
          )}

          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative h-full w-full overflow-visible" role="img" aria-label={`Level ${progress.currentLevel}, ${Math.round(pct)} percent to the next level`}>
            <defs>
              <linearGradient id={`${gid}-arc`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.accent} />
              </linearGradient>
              <radialGradient id={`${gid}-disc`} cx="50%" cy="38%" r="70%">
                <stop offset="0%" stopColor={theme.primary} stopOpacity={isMax ? 0.34 : 0.22} />
                <stop offset="100%" stopColor="#100D17" stopOpacity="0.9" />
              </radialGradient>
              <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {Array.from({ length: TICKS }, (_, i) => {
              const angle = (i * 360) / TICKS;
              const major = i % 5 === 0;
              const lit = shown > 0 && angle <= (shown / 100) * 360;
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

            <circle cx={CENTER} cy={CENTER} r={RADIUS - STROKE / 2 - 4} fill="#100D17" />
            <circle cx={CENTER} cy={CENTER} r={RADIUS - STROKE / 2 - 4} fill={`url(#${gid}-disc)`} />
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />

            {[true, false].map((blur) => (
              <circle
                key={String(blur)}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={blur ? theme.primary : `url(#${gid}-arc)`}
                strokeOpacity={blur ? 0.75 : 1}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                filter={blur ? `url(#${gid}-glow)` : undefined}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                className={`lh-anim ${blur && (charging || isMax) ? "lh-breathe" : ""}`}
                style={{
                  strokeDashoffset: CIRC * (1 - Math.max(shown, isMax ? 0 : 0.8) / 100),
                  transition: `stroke-dashoffset 1.6s ${EASE}`,
                }}
              />
            ))}

            {/* comet at the tip of the arc */}
            {!isMax && (
              <g
                className="lh-anim"
                style={{
                  transform: `rotate(${(Math.max(shown, 0.8) / 100) * 360}deg)`,
                  transformOrigin: `${CENTER}px ${CENTER}px`,
                  transition: `transform 1.6s ${EASE}`,
                }}
              >
                {([
                  [22, 0.14, 3],
                  [13, 0.28, 4],
                  [6, 0.5, 5],
                ] as [number, number, number][]).map(([deg, op, w]) => {
                  const rad = (-deg * Math.PI) / 180;
                  const x0 = CENTER + RADIUS * Math.sin(rad);
                  const y0 = CENTER - RADIUS * Math.cos(rad);
                  return (
                    <path
                      key={deg}
                      d={`M ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER} ${CENTER - RADIUS}`}
                      fill="none"
                      stroke="#fff"
                      strokeOpacity={op}
                      strokeWidth={w}
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx={CENTER} cy={CENTER - RADIUS} r={charging ? 11 : 8} fill={theme.accent} className={charging ? "lh-spark lh-spark-fast" : "lh-spark"} opacity="0.5" />
                <circle cx={CENTER} cy={CENTER - RADIUS} r={4.5} fill="#fff" />
              </g>
            )}
          </svg>

          {/* level numeral */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[13px] font-medium text-white/50">Level</span>
            <span
              className={`font-black leading-none tabular-nums ${shiny ? "lh-shine-text" : "text-white"}`}
              style={{
                fontSize: numeralSize,
                letterSpacing: "-0.05em",
                filter: `drop-shadow(0 0 ${isMax ? 26 : 16}px ${theme.primary}b0)`,
              }}
            >
              {levelShown}
            </span>
            {!isMax && (
              <span className="mt-1 text-sm font-bold tabular-nums" style={{ color: theme.secondary }}>
                {Math.floor(pct)}%
              </span>
            )}
          </div>

          {/* crown */}
          {crownType && (
            <div
              className="pointer-events-none absolute left-1/2 z-20"
              style={{ width: crownWidth, height: (crownWidth * 96) / 140, top: 28, transform: "translate(-50%, -100%)" }}
            >
              <div className="lh-crown-in h-full w-full" style={{ filter: `drop-shadow(0 0 ${isMax ? 22 : 12}px ${theme.primary}cc)` }}>
                <div className="lh-float h-full w-full">
                  <CrownArt type={crownType} theme={theme} id={`${gid}-c`} />
                </div>
              </div>
            </div>
          )}

          {/* one-shot bursts */}
          {isMax && !celebrate && <Burst theme={theme} delay={1.5} />}
          {celebrate && <Burst theme={theme} count={36} delay={0.1} />}

          {celebrate && (
            <div className="lh-pop absolute -bottom-4 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black text-[#120E19]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, boxShadow: `0 10px 30px -6px ${theme.primary}` }}>
              Level up! You're now Level {progress.currentLevel}
            </div>
          )}
        </div>

        {/* The line that pulls people forward */}
        <div className="relative z-10 mt-6 text-center">
          {isMax ? (
            <>
              <p className="lh-shine-text text-[30px] font-black leading-tight tracking-tight">You're at the top</p>
              <p className="mt-1 text-sm text-white/55">No one in the app ranks higher.</p>
            </>
          ) : (
            <>
              <p className="text-[38px] font-black leading-none tracking-tight tabular-nums text-white">
                {xpShown.toLocaleString()} <span className="text-lg font-bold text-white/45">XP to go</span>
              </p>
              <p className="mt-2 text-sm text-white/55">
                until <span className="font-bold text-white">Level {progress.nextLevel}</span>
                {progress.nextTitle ? <>, and you become {progress.nextTitle}</> : null}
              </p>
              {charging && (
                <p
                  className="lh-chip mx-auto mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: `${theme.primary}26`, color: theme.accent, boxShadow: `0 0 0 1px ${theme.primary}55` }}
                >
                  Almost there, only {Math.max(1, Math.round(100 - pct))}% left
                </p>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <dl className="relative z-10 mt-5 grid grid-cols-2 divide-x divide-white/[0.08] rounded-2xl border border-white/[0.07] bg-black/25 py-3">
          <div className="px-4">
            <dt className="text-xs text-white/40">Total XP</dt>
            <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{totalShown.toLocaleString()}</dd>
          </div>
          <div className="px-4">
            <dt className="text-xs text-white/40">{isMax ? "Status" : "This level"}</dt>
            <dd className="mt-0.5 whitespace-nowrap text-[15px] font-bold tabular-nums text-white">
              {isMax ? "Maxed out" : `${Math.max(0, progress.totalXp - progress.currentLevelXp).toLocaleString()} / ${range.toLocaleString()}`}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
@property --lh-ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes lh-border-spin { to { --lh-ang: 360deg } }
.lh-border {
  background: conic-gradient(from var(--lh-ang), var(--lh-p), var(--lh-a), rgba(255,255,255,.06) 28%, var(--lh-s) 55%, rgba(255,255,255,.06) 78%, var(--lh-p));
  animation: lh-border-spin 5s linear infinite;
}
@keyframes lh-spin { to { transform: rotate(360deg) } }
@keyframes lh-spin-rev { to { transform: rotate(-360deg) } }
@keyframes lh-spark { 0%,100% { opacity:.5; transform:scale(1) } 50% { opacity:1; transform:scale(1.55) } }
@keyframes lh-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes lh-crown-in { 0% { opacity:0; transform: translateY(-46px) scale(.5) rotate(-6deg) } 60% { opacity:1; transform: translateY(6px) scale(1.06) rotate(1deg) } 100% { opacity:1; transform: none } }
@keyframes lh-shine { 0% { transform: translateX(-20px) } 55%,100% { transform: translateX(200px) } }
@keyframes lh-flap { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(5deg) } }
@keyframes lh-halo { 0%,100% { opacity:.55 } 50% { opacity:1 } }
@keyframes lh-twinkle { 0%,100% { opacity:.1; transform: scale(.6) } 50% { opacity:1; transform: scale(1.3) } }
@keyframes lh-rise { 0% { opacity:0; transform: translate(0,0) scale(.6) } 12% { opacity:.95 } 100% { opacity:0; transform: translate(var(--dx), -300px) scale(1) } }
@keyframes lh-wave { 0% { opacity:.55; transform: scale(.9) } 100% { opacity:0; transform: scale(1.95) } }
@keyframes lh-breathe { 0%,100% { opacity:.45 } 50% { opacity:1 } }
@keyframes lh-text { 0% { background-position: 220% 0 } 100% { background-position: -120% 0 } }
@keyframes lh-burst { 0% { transform: translate(-50%,-50%) scale(.2); opacity:.9 } 100% { transform: translate(-50%,-50%) scale(5.2); opacity:0 } }
@keyframes lh-shoot { 0% { opacity:0; transform: rotate(var(--a)) translateY(-30px) scaleY(.4) } 15% { opacity:1 } 100% { opacity:0; transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) scaleY(1) } }
@keyframes lh-pop { 0% { opacity:0; transform: translate(-50%,16px) scale(.6) } 60% { transform: translate(-50%,-3px) scale(1.06) } 100% { opacity:1; transform: translate(-50%,0) scale(1) } }
@keyframes lh-chip { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }

.lh-spark { transform-box: fill-box; transform-origin: center; animation: lh-spark 2.2s ease-in-out infinite }
.lh-spark-fast { animation-duration: .9s }
.lh-float { animation: lh-float 3.6s ease-in-out infinite }
.lh-crown-in { animation: lh-crown-in 1.1s cubic-bezier(.2,.9,.3,1.2) .5s both }
.lh-crown-shine { animation: lh-shine 3.8s ease-in-out 1.6s infinite }
.lh-wing { transform-box: fill-box; transform-origin: 100% 80%; animation: lh-flap 3.2s ease-in-out infinite }
.lh-halo { animation: lh-halo 2.4s ease-in-out infinite; filter: drop-shadow(0 0 4px var(--lh-a)) }
.lh-gem { transform-box: fill-box; transform-origin: center; animation: lh-spark 2.6s ease-in-out infinite }
.lh-twinkle-star { transform-box: fill-box; transform-origin: center; animation: lh-twinkle 2.2s ease-in-out infinite }
.lh-breathe { animation: lh-breathe 1.8s ease-in-out infinite }
.lh-chip { animation: lh-chip 1.4s ease-in-out infinite }
.lh-pop { animation: lh-pop .7s cubic-bezier(.2,.9,.3,1.2) both }

.lh-ember { position: absolute; bottom: -6px; border-radius: 999px; pointer-events: none; animation: lh-rise linear infinite }
.lh-rays { position: absolute; left: 50%; top: 50%; width: 560px; height: 560px; margin: -280px 0 0 -280px; border-radius: 999px; pointer-events: none;
  -webkit-mask-image: radial-gradient(circle, #000 18%, transparent 56%); mask-image: radial-gradient(circle, #000 18%, transparent 56%); animation: lh-spin 46s linear infinite }
.lh-wave { position: absolute; left: 15px; top: 15px; right: 15px; bottom: 15px; border: 2px solid; border-radius: 999px; pointer-events: none; animation: lh-wave 3.6s ease-out infinite }
.lh-orbit { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; animation: lh-spin 18s linear infinite }
.lh-orbit-rev { animation-name: lh-spin-rev }
.lh-dot { position: absolute; left: 0; top: 0; margin: -3px 0 0 -3px }
.lh-sweep { position: absolute; left: 15px; top: 15px; right: 15px; bottom: 15px; border-radius: 999px; pointer-events: none; opacity: .9;
  -webkit-mask-image: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px)); mask-image: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px)); animation: lh-spin 4s linear infinite }
.lh-shine-text { color: transparent; -webkit-background-clip: text; background-clip: text; background-size: 260% 100%;
  background-image: linear-gradient(105deg, #fff 36%, var(--lh-a) 46%, #fff 54%, var(--lh-s) 64%, #fff 74%); animation: lh-text 3.6s linear infinite }
.lh-burst-ring { position: absolute; left: 0; top: 0; width: 120px; height: 120px; border: 3px solid; border-radius: 999px; opacity: 0; animation: lh-burst 1.3s ease-out both }
.lh-shoot { position: absolute; left: 0; top: 0; border-radius: 3px; opacity: 0; animation: lh-shoot 1.2s cubic-bezier(.1,.7,.3,1) both }

@media (prefers-reduced-motion: reduce) {
  .lh-fx *, .lh-border { animation: none !important }
  .lh-fx .lh-anim { transition: none !important }
  .lh-ember, .lh-rays, .lh-wave, .lh-orbit, .lh-sweep, .lh-burst-ring, .lh-shoot { display: none }
  .lh-shine-text { color: #fff; background-image: none }
}
`;