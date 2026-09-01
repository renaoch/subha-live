"use client";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PkState } from "@/lib/api/pk";

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface PkBattleBarProps {
  state: PkState | null;
  onOpen?: () => void;
}

/**
 * Compact always-on battle bar, shown while a PK is active/finished so the
 * score + timer are visible without opening the PK sheet.
 */
export function PkBattleBar({ state, onOpen }: PkBattleBarProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state || state.status !== "ACTIVE") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state?.status, state?.battleId]);

  if (!state) return null;
  const active = state.status === "ACTIVE";
  const finished = state.status === "FINISHED" || state.status === "FINALIZING";
  if (!active && !finished) return null;

  const remaining = state.endsAt != null ? state.endsAt - now : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute inset-x-0 top-[118px] z-40 mx-4 flex items-center justify-between rounded-2xl border border-[#F5B93F]/30 bg-black/55 px-3 py-2 backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5B93F]/20 text-[#F5B93F]">
          <Swords className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[12px] font-bold text-white">
          PK Battle
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {active && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black tabular-nums text-white">
            {formatRemaining(remaining)}
          </span>
        )}
        <span
          className={cn(
            "text-[12px] font-black tabular-nums",
            finished ? "text-[#F5B93F]" : "text-white",
          )}
        >
          {finished
            ? state.winner === "DRAW"
              ? "Draw"
              : `${state.winner === "A" ? "A" : "B"} wins`
            : `${formatCoins(state.scoreA)} : ${formatCoins(state.scoreB)}`}
        </span>
      </div>
    </button>
  );
}
