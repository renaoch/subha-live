"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLastPk } from "@/hooks/queries/use-pk";
import { formatCoins, PK_GOLD } from "./pkTheme";

interface LastPKCardProps {
  hostId: string | null | undefined;
  onView?: () => void;
}

/**
 * Small "Last PK" achievement card shown inside a live room when the host
 * has a finished PK on record. Reads real history from the backend — never
 * shown until data actually loads, and quietly renders nothing if the host
 * has no PK history yet.
 */
export function LastPKCard({ hostId, onView }: LastPKCardProps) {
  const { data: last, isLoading } = useLastPk(hostId);

  if (isLoading || !last) return null;

  const won = last.result === "WIN";
  const draw = last.result === "DRAW";
  const accent = draw ? "#9CA3AF" : won ? PK_GOLD : "#6B7280";

  return (
    <motion.button
      type="button"
      onClick={onView}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-2.5 py-2 text-left backdrop-blur-xl transition active:scale-[0.98]"
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 0 14px ${accent}33` }}
    >
      <Avatar name={last.opponentName} src={last.opponentAvatar ?? undefined} size="sm" className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-wide text-white/50">Last PK</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-[1px] text-[8px] font-black uppercase",
              draw ? "bg-white/15 text-white/70" : won ? "text-black" : "bg-white/10 text-white/60",
            )}
            style={won ? { background: PK_GOLD } : undefined}
          >
            {last.result}
          </span>
        </div>
        <p className="truncate text-[11px] font-bold text-white">
          {formatCoins(last.myScore)} <span className="text-white/40">vs</span> {formatCoins(last.opponentScore)}
          <span className="ml-1.5 font-medium text-white/40">· {last.opponentName}</span>
        </p>
      </div>
    </motion.button>
  );
}
