"use client";

import { useMemo } from "react";
import { LuckySymbol } from "./LuckySymbol";
import type { LuckyRingCell } from "@/lib/api/lucky-ring";
import { cn } from "@/lib/utils";

// On-screen perimeter order for the chase-light animation: top row L->R (0-3),
// down the right side (5), bottom row R->L (9-6), up the left side (4), back
// to the top-left (0). Matches the reference cabinet's border-light travel.
const CHASE_ORDER = [0, 1, 2, 3, 5, 9, 8, 7, 6, 4];

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
  const chaseHighlight = useMemo(() => {
    if (status !== "SPINNING" || winningCell == null) return null;
    const winPos = CHASE_ORDER.indexOf(winningCell);
    if (winPos === -1) return winningCell;
    // Two full loops plus however many more steps land exactly on winPos —
    // guaranteed to end on the true winning cell when msLeft hits 0.
    const totalSteps = 20 + winPos;
    const elapsed = spinMs > 0 ? 1 - msLeft / spinMs : 1;
    const step = Math.round(easeOutCubic(elapsed) * totalSteps);
    return CHASE_ORDER[step % CHASE_ORDER.length];
  }, [status, winningCell, spinMs, msLeft]);

  const revealedCell = status === "SETTLED" ? winningCell : chaseHighlight;

  function renderCell(index: number) {
    const cell = cells.find((c) => c.index === index);
    if (!cell) return null;
    const isLit = revealedCell === index;
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
          isLit && "border-[#FFE08A] shadow-[0_0_22px_rgba(255,224,138,0.75)] scale-[1.04]",
          isWinner && "animate-[pop-in_0.4s_ease-out] bg-[#F5B93F]/20",
          status === "BETTING" && "active:scale-95",
        )}
      >
        <LuckySymbol id={cell.symbol} size={40} className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
        {cell.symbol !== "lucky" ? (
          <span className={cn("text-[9px] font-bold leading-none", isLit ? "text-[#FFE08A]" : "text-[#F5B93F]/70")}>
            {cell.multiplier} times
          </span>
        ) : null}
        {myBet ? (
          <span className="absolute -top-1.5 -right-1.5 rounded-full border border-[#F5B93F] bg-[#7c2ae0] px-1.5 py-0.5 text-[9px] font-black text-white shadow">
            {myBet >= 1000 ? `${Math.round(myBet / 1000)}K` : myBet}
          </span>
        ) : null}
        {placingCell === index && (
          <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/10 animate-pulse" />
        )}
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
    <div className="rounded-[22px] border-2 border-[#F5B93F]/60 bg-gradient-to-b from-[#5a1418] via-[#38090c] to-[#1c0506] p-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(245,185,63,0.15)]">
      <p className="mb-2 text-center text-[11px] font-medium text-[#F5B93F]/70">
        Round {roundNumber} of today
      </p>
      <div className="grid grid-cols-4 gap-2">
        {renderCell(0)}
        {renderCell(1)}
        {renderCell(2)}
        {renderCell(3)}

        {renderCell(4)}
        <div className="col-span-2 flex aspect-[2/1] items-center justify-center rounded-xl border border-[#F5B93F]/50 bg-gradient-to-b from-[#3a0d10] to-[#1c0506] shadow-[inset_0_0_0_1px_rgba(245,185,63,0.25)]">
          <span
            className="font-mono text-3xl font-black tabular-nums text-[#FFE08A]"
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