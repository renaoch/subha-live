// components/HostGiftMeter.tsx
"use client";

import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface HostGiftMeterProps {
  /** Total diamond value of gifts received in this room during this session. */
  totalDiamonds: number;
  /** Number of gift sends that made up the total, for the small label. */
  giftCount: number;
  className?: string;
}

/**
 * A quiet, always-visible bar showing how many gifts (in diamonds) the
 * host has received so far this live session — separate from
 * RoomTaskBar (which tracks progress toward a configured goal). This bar
 * has no goal/target, it's a running session total.
 *
 * Purely a read-only display: the diamond total is derived client-side
 * from the public gift catalog's diamond_value (fetched once from
 * /api/v1/financial/gifts, same as the gift picker) multiplied by the
 * quantities already broadcast in the room's live chat feed — the same
 * "gift" events RoomChat renders as "User X sent Y". No balance or
 * ledger data ever reaches the client; this never doubles as the
 * authoritative earnings figure (see host_earnings / the wallet page for
 * that), it's just a live crowd-visible meter.
 */
export function HostGiftMeter({ totalDiamonds, giftCount, className }: HostGiftMeterProps) {
  if (giftCount === 0) return null;

  return (
    <div className={cn("absolute inset-x-0 top-[104px] z-20 px-4", className)}>
      <div className="flex items-center gap-2 rounded-full border border-[#57C2FF]/25 bg-black/25 px-3 py-1.5 backdrop-blur-xl">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#57C2FF]/20">
          <Gem className="h-3 w-3 text-[#57C2FF]" />
        </div>
        <p className="text-[11px] font-bold leading-none text-white">
          {formatCompact(totalDiamonds)}
          <span className="ml-1 font-medium text-white/50">diamonds this stream</span>
        </p>
        <span className="ml-auto shrink-0 text-[10px] font-semibold leading-none text-white/40">
          {giftCount} gift{giftCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

