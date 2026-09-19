"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { PK_SIDE_A_COLOR, PK_SIDE_B_COLOR, PK_GOLD, formatCoins, formatDuration } from "./pkTheme";
import type { PkWinner } from "@/lib/api/pk";

interface PKResultAnimationProps {
  /** Winner as reported by the backend PK result — never derived locally. */
  winner: PkWinner;
  hostAName: string;
  hostAAvatar?: string | null;
  hostBName: string;
  hostBAvatar?: string | null;
  scoreA: number;
  scoreB: number;
  durationMs: number | null;
  onDone: () => void;
  /** How long the result stays up before auto-dismissing back to the live
   * room. A tap anywhere also dismisses it early. */
  autoDismissMs?: number;
}

/**
 * Post-PK victory/result screen. Purely presentational — the winner is a
 * prop sourced from the backend PK_RESULT event, this component never
 * infers it from scores. Auto-dismisses so the UI can't get stuck here if
 * the viewer never taps through.
 */
export function PKResultAnimation({
  winner,
  hostAName,
  hostAAvatar,
  hostBName,
  hostBAvatar,
  scoreA,
  scoreB,
  durationMs,
  onDone,
  autoDismissMs = 4500,
}: PKResultAnimationProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const t = window.setTimeout(onDone, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [onDone, autoDismissMs]);

  const aWins = winner === "A";
  const bWins = winner === "B";
  const isDraw = winner === "DRAW";

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Dismiss PK result"
      className="absolute inset-0 z-[85] flex flex-col items-center justify-center bg-black/90 px-6 text-center"
    >
      {!prefersReducedMotion && !isDraw && <ResultGlow color={aWins ? PK_SIDE_A_COLOR : PK_SIDE_B_COLOR} />}

      <motion.span
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-xs font-bold uppercase tracking-[0.3em] text-white/60"
      >
        PK Result
      </motion.span>

      <motion.h2
        initial={prefersReducedMotion ? undefined : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="mt-1 text-4xl font-black tracking-wide text-white"
        style={{ textShadow: isDraw ? "none" : `0 0 30px ${PK_GOLD}` }}
      >
        {isDraw ? "DRAW" : "WINNER"}
      </motion.h2>

      <div className="mt-6 flex w-full max-w-xs items-center justify-center gap-6">
        <ResultSide
          name={hostAName}
          avatar={hostAAvatar}
          score={scoreA}
          color={PK_SIDE_A_COLOR}
          won={aWins}
          reduced={!!prefersReducedMotion}
        />
        <span className="text-lg font-bold text-white/40">vs</span>
        <ResultSide
          name={hostBName}
          avatar={hostBAvatar}
          score={scoreB}
          color={PK_SIDE_B_COLOR}
          won={bWins}
          reduced={!!prefersReducedMotion}
        />
      </div>

      {durationMs != null && (
        <p className="mt-6 text-xs font-medium text-white/50">
          Battle duration: {formatDuration(durationMs)}
        </p>
      )}

      <span className="mt-8 text-[11px] font-medium text-white/30">Tap to continue</span>
    </button>
  );
}

function ResultSide({
  name,
  avatar,
  score,
  color,
  won,
  reduced,
}: {
  name: string;
  avatar?: string | null;
  score: number;
  color: string;
  won: boolean;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={reduced ? undefined : { opacity: 0, y: 12 }}
      animate={{ opacity: won ? 1 : 0.55, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div
        className="relative rounded-full p-1"
        style={{ border: `2px solid ${color}`, boxShadow: won ? `0 0 20px ${color}` : "none" }}
      >
        <Avatar name={name} src={avatar ?? undefined} size="lg" className="h-16 w-16" />
        {won && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-black"
            style={{ background: PK_GOLD }}
          >
            Win
          </span>
        )}
      </div>
      <span className="max-w-[90px] truncate text-xs font-bold text-white">{name}</span>
      <span className="text-sm font-black tabular-nums text-white">{formatCoins(score)}</span>
    </motion.div>
  );
}

/** A soft radial glow tinted to the winner's color — the one "screen
 * emphasis" effect here, static after its entrance so it doesn't compete
 * with the result content or keep animating. */
function ResultGlow({ color }: { color: string }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      style={{ background: `radial-gradient(circle, ${color}55, transparent 70%)` }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    />
  );
}
