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

  // Center cell (index 4) is styled as the "counter" readout, echoing the
  // classic ring-style lucky board — the perimeter (0,1,2,3,5,6,7,8) reads as
  // the 8 outer positions, same as every payline symbol still in play.
  const multiplierById = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of symbols) map.set(s.id, s.id === "lucky" ? undefined! : s.multiplier);
    return map;
  }, [symbols]);

  const cells = Array.from({ length: 9 }, (_, i) => {
    const settled = revealing && finalSymbols && i < revealed;
    const symbolId = settled
      ? finalSymbols![i]
      : symbols[(tick + i) % symbols.length].id;
    const isWinning = settled && winningCells.has(i);
    const isCenter = i === 4;
    const mult = multiplierById.get(symbolId);

    return (
      <div
        key={i}
        className={cn(
          "relative flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-200",
          isCenter
            ? "border-[#F5B93F]/50 bg-gradient-to-b from-[#3a0d10] to-[#1c0506] shadow-[inset_0_0_0_1px_rgba(245,185,63,0.25)]"
            : "border-[#F5B93F]/20 bg-gradient-to-b from-[#4a1216]/80 to-[#1c0708] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          isWinning && "border-[#F5B93F] bg-[#F5B93F]/15 shadow-[0_0_18px_rgba(245,185,63,0.45)]",
        )}
        style={{ aspectRatio: "1 / 1" }}
      >
        <LuckySymbol
          id={symbolId}
          size={isCenter ? 40 : 44}
          className={cn(
            "drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]",
            isWinning && "animate-[pop-in_0.3s_ease-out]",
          )}
        />
        {!isCenter && mult ? (
          <span
            className={cn(
              "text-[9px] font-bold leading-none",
              isWinning ? "text-[#FFE08A]" : "text-[#F5B93F]/70",
            )}
          >
            {mult} times
          </span>
        ) : null}
        {isWinning && (
          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#F5B93F]/60" />
        )}
      </div>
    );
  });

  return (
    <div className="relative">
      {/* Ornate red/gold "Lucky Pro" style frame */}
      <div className="rounded-[22px] border-2 border-[#F5B93F]/60 bg-gradient-to-b from-[#5a1418] via-[#38090c] to-[#1c0506] p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(245,185,63,0.15)]">
        <div className="grid grid-cols-3 gap-2">{cells}</div>
      </div>
    </div>
  );
}