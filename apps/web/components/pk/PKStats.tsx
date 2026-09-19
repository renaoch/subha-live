"use client";

import { Loader2 } from "lucide-react";
import { usePkStats } from "@/hooks/queries/use-pk";
import { formatCoins, PK_GOLD } from "./pkTheme";

interface PKStatsProps {
  hostId: string | null | undefined;
}

/**
 * Compact PK record summary (battles / wins / losses / win rate / streak).
 * All numbers come from `usePkStats`, computed server-side from finished
 * battles — nothing here is hardcoded.
 */
export function PKStats({ hostId }: PKStatsProps) {
  const { data: stats, isLoading } = usePkStats(hostId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!stats || stats.totalBattles === 0) {
    return <p className="py-6 text-center text-xs font-medium text-white/40">No PK record yet</p>;
  }

  const cells: Array<{ label: string; value: string }> = [
    { label: "Battles", value: `${stats.totalBattles}` },
    { label: "Wins", value: `${stats.wins}` },
    { label: "Losses", value: `${stats.losses}` },
    { label: "Win Rate", value: `${stats.winRate}%` },
    { label: "Win Streak", value: `${stats.currentStreak}` },
    { label: "Best Score", value: formatCoins(stats.highestScore) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.03] py-3"
        >
          <span className="text-base font-black tabular-nums text-white" style={{ color: PK_GOLD }}>
            {cell.value}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}
