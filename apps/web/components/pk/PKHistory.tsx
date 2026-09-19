"use client";

import { Loader2, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePkHistory } from "@/hooks/queries/use-pk";
import { formatCoins, formatRelativeTime, PK_GOLD } from "./pkTheme";

interface PKHistoryProps {
  hostId: string | null | undefined;
  limit?: number;
}

/**
 * Compact PK history list — a stack of result rows, not a database table.
 * Backed entirely by the finished `pk_battles` rows for this host (via
 * `usePkHistory`), so it reflects real outcomes with no local computation.
 */
export function PKHistory({ hostId, limit = 20 }: PKHistoryProps) {
  const { data: history, isLoading } = usePkHistory(hostId, limit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-white/40">
        <Swords className="h-6 w-6" />
        <p className="text-xs font-medium">No PK battles yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((entry) => {
        const won = entry.result === "WIN";
        const draw = entry.result === "DRAW";
        return (
          <div
            key={entry.battleId}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5",
            )}
          >
            <Avatar name={entry.opponentName} src={entry.opponentAvatar ?? undefined} size="sm" className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{entry.opponentName}</p>
              <p className="text-[11px] font-medium text-white/40">
                {formatRelativeTime(entry.endedAt)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                  draw ? "bg-white/15 text-white/70" : won ? "text-black" : "bg-white/10 text-white/50",
                )}
                style={won ? { background: PK_GOLD } : undefined}
              >
                {entry.result}
              </span>
              <span className="text-[11px] font-black tabular-nums text-white/80">
                {formatCoins(entry.myScore)} <span className="text-white/30">vs</span> {formatCoins(entry.opponentScore)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
