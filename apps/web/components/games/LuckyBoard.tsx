// components/games/LuckyBoard.tsx
//
// The 3x3 reel board. Purely presentational: it animates the reel spin and the
// staggered reveal of the SERVER-authoritative result. It never computes an
// outcome — it only plays back `result.result.symbols`.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LuckyPublicConfig, LuckySpinResult } from "@/lib/api/lucky";
import { LuckySymbol } from "@/components/games/LuckySymbol";
import { playLuckyStopSound } from "@/lib/sound";

interface LuckyBoardProps {
  config: LuckyPublicConfig;
  spinning: boolean;
  revealing: boolean;
  result: LuckySpinResult | null;
  onRevealed: () => void;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function LuckyBoard({ config, spinning, revealing, result, onRevealed }: LuckyBoardProps) {
  const symbols = config.symbols;
  const [tick, setTick] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const reduced = usePrefersReducedMotion();
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  // Fast reel tick while spinning (or until a cell has settled).
  useEffect(() => {
    if (!spinning && !revealing) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 80);
    return () => window.clearInterval(id);
  }, [spinning, revealing]);

  // Reset the reveal counter when a new spin starts.
  useEffect(() => {
    if (spinning) setRevealed(0);
  }, [spinning]);

  // Staggered reveal of the authoritative result.
  useEffect(() => {
    if (!revealing || !result) return;
    if (reduced) {
      setRevealed(9);
      return;
    }
    setRevealed(0);
    const id = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= 9) {
          window.clearInterval(id);
          return r;
        }
        playLuckyStopSound();
        return r + 1;
      });
    }, 130);
    return () => window.clearInterval(id);
  }, [revealing, result, reduced]);

  // Notify the parent once fully revealed.
  useEffect(() => {
    if (revealing && revealed >= 9 && result) {
      const t = window.setTimeout(() => onRevealedRef.current(), reduced ? 0 : 450);
      return () => window.clearTimeout(t);
    }
  }, [revealing, revealed, result, reduced]);

  const finalSymbols = result?.result.symbols ?? null;
  const winningCells = useMemo(() => {
    const set = new Set<number>();
    for (const line of result?.result.winningLines ?? []) for (const i of line) set.add(i);
    return set;
  }, [result]);

  const cells = Array.from({ length: 9 }, (_, i) => {
    const settled = revealing && finalSymbols && i < revealed;
    const symbolId = settled
      ? finalSymbols![i]
      : symbols[(tick + i) % symbols.length].id;
    const isWinning = settled && winningCells.has(i);

    return (
      <div
        key={i}
        className={cn(
          "relative flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200",
          isWinning && "border-[#F5B93F]/70 bg-[#F5B93F]/10 shadow-[0_0_18px_rgba(245,185,63,0.35)]",
        )}
        style={{ aspectRatio: "1 / 1" }}
      >
        <LuckySymbol
          id={symbolId}
          size={52}
          className={cn(
            "drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]",
            isWinning && "animate-[pop-in_0.3s_ease-out]",
          )}
        />
        {isWinning && (
          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#F5B93F]/50" />
        )}
      </div>
    );
  });

  return (
    <div className="relative">
      {/* Premium gold/dark frame */}
      <div className="rounded-[22px] border border-[#F5B93F]/25 bg-gradient-to-b from-[#2a1b2e] via-[#1a1120] to-[#120b16] p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(245,185,63,0.08)]">
        <div className="grid grid-cols-3 gap-2">{cells}</div>
      </div>
    </div>
  );
}
