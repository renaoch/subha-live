"use client";

import { useEffect, useReducer, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { PK_SIDE_A_COLOR, PK_SIDE_B_COLOR } from "./pkTheme";

interface PKStartAnimationProps {
  hostAName: string;
  hostAAvatar?: string | null;
  hostBName: string;
  hostBAvatar?: string | null;
  /** Called once the whole sequence (VS intro + countdown + "PK START!") is
   * done, so the caller can swap over to the live battle UI. Also called if
   * the sequence is forcibly cut short by `skip`. */
  onComplete: () => void;
  /** Set true to end the animation immediately (e.g. the PK ended before the
   * intro finished, or the component is unmounting) instead of waiting out
   * the timers. */
  skip?: boolean;
}

type Phase = "enter" | "vs" | "countdown" | "go" | "done";

const PHASE_DURATIONS_MS: Record<Exclude<Phase, "done">, number> = {
  enter: 600,
  vs: 900,
  countdown: 3_000, // 3 ticks x 1000ms, driven by its own sub-timer below
  go: 700,
};

/**
 * Full-screen PK intro: both hosts slide in from opposite edges, colors
 * clash at a center "VS", then a 3-2-1 countdown resolves into "PK START!".
 * Runs once, self-terminates, and never re-triggers — the caller mounts
 * this component only for the STARTING window and unmounts it once
 * `onComplete` fires (or the PK's active/ended state supersedes it).
 */
export function PKStartAnimation({
  hostAName,
  hostAAvatar,
  hostBName,
  hostBAvatar,
  onComplete,
  skip,
}: PKStartAnimationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("enter");
  const [count, setCount] = useState(3);

  // Reduced motion: skip straight to a brief, static "PK START" flash
  // instead of the full sequence, per prefers-reduced-motion.
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const t = window.setTimeout(onComplete, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || skip) return;
    if (phase === "done") return;

    if (phase === "countdown") {
      // 3 -> 2 -> 1, one second apart, then advance to "go".
      if (count <= 1) {
        const t = window.setTimeout(() => setPhase("go"), 1000);
        return () => window.clearTimeout(t);
      }
      const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
      return () => window.clearTimeout(t);
    }

    const next: Record<string, Phase> = { enter: "vs", vs: "countdown", go: "done" };
    const duration = PHASE_DURATIONS_MS[phase as Exclude<Phase, "done" | "countdown">];
    const t = window.setTimeout(() => setPhase(next[phase]), duration);
    return () => window.clearTimeout(t);
  }, [phase, count, prefersReducedMotion, skip]);

  useEffect(() => {
    if (phase === "done") onComplete();
  }, [phase, onComplete]);

  // A forced skip (PK already ended, or the animation host unmounted it)
  // fires completion immediately rather than waiting out timers.
  useEffect(() => {
    if (skip) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  if (skip || phase === "done") return null;

  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/80">
        <span className="text-2xl font-black tracking-wide text-white">PK START!</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[85] overflow-hidden bg-black">
      {/* Two color fields racing in from each side, clashing at center. */}
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2"
        style={{ background: `linear-gradient(90deg, ${PK_SIDE_A_COLOR}55, transparent)` }}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2"
        style={{ background: `linear-gradient(270deg, ${PK_SIDE_B_COLOR}55, transparent)` }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Center clash glow, once both sides have arrived. */}
      <AnimatePresence>
        {phase !== "enter" && (
          <motion.div
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${PK_GOLD_GLOW}, transparent 70%)` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.9, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Host avatars, sliding in and settling either side of center. */}
      <div className="absolute inset-0 flex items-center justify-between px-10">
        <HostBadge name={hostAName} avatar={hostAAvatar} color={PK_SIDE_A_COLOR} fromX={-80} active={phase !== "enter"} />
        <HostBadge name={hostBName} avatar={hostBAvatar} color={PK_SIDE_B_COLOR} fromX={80} active={phase !== "enter"} mirrored />
      </div>

      {/* VS mark. */}
      <AnimatePresence>
        {(phase === "vs" || phase === "countdown") && (
          <motion.div
            key="vs"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl font-black italic text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
            initial={{ scale: 0, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
          >
            VS
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown numerals. */}
      <AnimatePresence mode="wait">
        {phase === "countdown" && (
          <motion.div
            key={`count-${count}`}
            className="absolute left-1/2 top-[64%] -translate-x-1/2 -translate-y-1/2 text-7xl font-black text-white"
            style={{ textShadow: `0 0 30px ${PK_GOLD}` }}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {count}
          </motion.div>
        )}
      </AnimatePresence>

      {/* "PK START!" finale. */}
      <AnimatePresence>
        {phase === "go" && (
          <motion.div
            key="go"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-black tracking-wider text-white"
              style={{ textShadow: `0 0 24px ${PK_GOLD}` }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              PK START!
            </motion.span>
            <Sparkburst />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PK_GOLD_GLOW = "rgba(245,185,63,0.9)";
const PK_GOLD = "#F5B93F";

function HostBadge({
  name,
  avatar,
  color,
  fromX,
  active,
  mirrored,
}: {
  name: string;
  avatar?: string | null;
  color: string;
  fromX: number;
  active: boolean;
  mirrored?: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ x: fromX, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="rounded-full p-1"
        style={{ boxShadow: active ? `0 0 24px ${color}` : "none", border: `2px solid ${color}` }}
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
      >
        <Avatar name={name} src={avatar ?? undefined} size="lg" className="h-16 w-16" />
      </motion.div>
      <span
        className={mirrored ? "text-right text-sm font-bold text-white" : "text-sm font-bold text-white"}
      >
        {name}
      </span>
    </motion.div>
  );
}

/** A handful of small particles bursting outward — cheap CSS-transform
 * spans, not an animation library or canvas, kept small so it never taxes
 * the GPU budget the video streams need. */
function Sparkburst() {
  const particles = Array.from({ length: 10 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 70 + (i % 3) * 20;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 2 === 0 ? PK_SIDE_A_COLOR : PK_SIDE_B_COLOR }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
