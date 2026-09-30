"use client";

import { useMemo } from "react";
import { LuckySymbol } from "./LuckySymbol";
import { WinCelebration } from "./WinCelebration";
import type { LuckyRingCell } from "@/lib/api/lucky-ring";
import { cn } from "@/lib/utils";

// On-screen perimeter order for the chase-light animation: top row L->R (0-3),
// down the right side (5), bottom row R->L (9-6), up the left side (4), back
// to the top-left (0). Matches the reference cabinet's border-light travel.
const CHASE_ORDER = [0, 1, 2, 3, 5, 9, 8, 7, 6, 4];
const TAIL_LENGTH = 3; // how many cells behind the head still glow, fading out — the "comet tail"

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

interface LuckyRingBoardProps {
  cells: LuckyRingCell[];
  status: "BETTING" | "SPINNING" | "SETTLED";
  winningCell: number | null;
  spinMs: number;
  msLeft: number;
  myBets: Record<number, number>;
  placingCell: number | null;
  onCellTap: (cellIndex: number) => void;
  roundNumber: number;
}

export function LuckyRingBoard({
  cells,
  status,
  winningCell,
  spinMs,
  msLeft,
  myBets,
  placingCell,
  onCellTap,
  roundNumber,
}: LuckyRingBoardProps) {
  const chaseStep = useMemo(() => {
    if (status !== "SPINNING" || winningCell == null) return null;
    const winPos = CHASE_ORDER.indexOf(winningCell);
    if (winPos === -1) return null;
    // Two full loops plus however many more steps land exactly on winPos —
    // guaranteed to end on the true winning cell when msLeft hits 0.
    const totalSteps = 20 + winPos;
    const elapsed = spinMs > 0 ? 1 - msLeft / spinMs : 1;
    return Math.round(easeOutCubic(elapsed) * totalSteps);
  }, [status, winningCell, spinMs, msLeft]);

  // Comet tail: the head cell glows brightest, the previous couple of cells
  // glow at falling opacity — reads as motion instead of a single cell
  // blinking, especially once the animation slows down near the end.
  const tailOpacity = useMemo(() => {
    const map = new Map<number, number>();
    if (chaseStep == null) return map;
    for (let back = 0; back <= TAIL_LENGTH; back++) {
      const step = chaseStep - back;
      if (step < 0) continue;
      const cellIndex = CHASE_ORDER[step % CHASE_ORDER.length];
      const opacity = 1 - back / (TAIL_LENGTH + 1);
      if (!map.has(cellIndex) || map.get(cellIndex)! < opacity) map.set(cellIndex, opacity);
    }
    return map;
  }, [chaseStep]);

  const urgent = status === "BETTING" && msLeft > 0 && msLeft <= 3000;

  function renderCell(index: number) {
    const cell = cells.find((c) => c.index === index);
    if (!cell) return null;
    const glow = tailOpacity.get(index) ?? 0;
    const isHead = glow === 1;
    const isWinner = status === "SETTLED" && winningCell === index;
    const myBet = myBets[index];

    return (
      <button
        key={index}
        type="button"
        disabled={status !== "BETTING"}
        onClick={() => onCellTap(index)}
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition-all duration-150",
          "border-[#F5B93F]/30 bg-gradient-to-b from-[#4a1216] to-[#1c0708]",
          isHead && "border-[#FFE08A] scale-[1.08]",
          isWinner && "border-[#FFE08A] bg-[#F5B93F]/25 animate-coin-shake scale-[1.06]",
          status === "BETTING" && "active:scale-90",
        )}
        style={
          glow > 0
            ? { boxShadow: `0 0 ${22 * glow}px rgba(255,224,138,${0.8 * glow})` }
            : isWinner
              ? { boxShadow: "0 0 28px rgba(255,224,138,0.9)" }
              : undefined
        }
      >
        <LuckySymbol id={cell.symbol} size={40} className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
        {cell.symbol !== "lucky" ? (
          <span
            className={cn(
              "text-[9px] font-bold leading-none transition-colors",
              glow > 0.4 || isWinner ? "text-[#FFE08A]" : "text-[#F5B93F]/70",
            )}
          >
            {cell.multiplier} times
          </span>
        ) : null}
        {myBet ? (
          <span className="absolute -top-1.5 -right-1.5 animate-pop-in rounded-full border border-[#F5B93F] bg-[#7c2ae0] px-1.5 py-0.5 text-[9px] font-black text-white shadow">
            {myBet >= 1000 ? `${Math.round(myBet / 1000)}K` : myBet}
          </span>
        ) : null}
        {placingCell === index && (
          <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-chip-toss text-base">
            🪙
          </span>
        )}
        {isWinner && <WinCelebration triggerKey={`cell-${roundNumber}`} />}
      </button>
    );
  }

  const counterLabel =
    status === "BETTING"
      ? Math.ceil(msLeft / 1000)
      : status === "SPINNING"
        ? "•••"
        : winningCell != null
          ? String(winningCell)
          : "--";

  return (
    <div
      className={cn(
        "rounded-[22px] border-2 border-[#F5B93F]/60 bg-gradient-to-b from-[#5a1418] via-[#38090c] to-[#1c0506] p-2.5",
        "shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(245,185,63,0.15)]",
        urgent && "animate-ring-urgent",
      )}
    >
      <p className="mb-2 text-center text-[11px] font-medium text-[#F5B93F]/70">
        Round {roundNumber} of today
      </p>
      <div className="relative grid grid-cols-4 gap-2">
        {renderCell(0)}
        {renderCell(1)}
        {renderCell(2)}
        {renderCell(3)}

        {renderCell(4)}
        <div
          className={cn(
            "col-span-2 flex aspect-[2/1] items-center justify-center rounded-xl border transition-all duration-300",
            "border-[#F5B93F]/50 bg-gradient-to-b from-[#3a0d10] to-[#1c0506] shadow-[inset_0_0_0_1px_rgba(245,185,63,0.25)]",
            status === "SETTLED" && "animate-pop-in border-[#FFE08A]",
          )}
        >
          <span
            key={`${status}-${counterLabel}`}
            className="animate-count-flash font-mono text-3xl font-black tabular-nums text-[#FFE08A]"
            style={{ textShadow: "0 0 12px rgba(255,224,138,0.6)" }}
          >
            {counterLabel}
          </span>
        </div>
        {renderCell(5)}

        {renderCell(6)}
        {renderCell(7)}
        {renderCell(8)}
        {renderCell(9)}
      </div>
    </div>
  );
}