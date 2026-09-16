"use client";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
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
  /** This room's host — known locally, so their side always gets a real
      name/avatar. The other side stays a generic "Opponent" pane, same
      as PkDualVideo, since the opponent's profile isn't resolved here. */
  roomHostId?: string | null;
  hostName?: string | null;
  hostAvatar?: string | null;
}

/**
 * Compact always-on battle bar, shown while a PK is active/finished so the
 * score + timer are visible without opening the PK sheet. Styled like the
 * rest of the in-room glass chrome (RoomHeader's pills, RoomChat's frosted
 * bar) rather than a standalone card, so it reads as part of the same
 * screen instead of a different product.
 */
export function PkBattleBar({ state, onOpen, roomHostId, hostName, hostAvatar }: PkBattleBarProps) {
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
  const hostIsA = roomHostId != null && roomHostId === state.hostA;
  const hostIsB = roomHostId != null && roomHostId === state.hostB;

  const sideAName = hostIsA ? hostName || "Host" : "Host A";
  const sideAAvatar = hostIsA ? hostAvatar ?? undefined : undefined;
  const sideBName = hostIsB ? hostName || "Host" : "Opponent";
  const sideBAvatar = hostIsB ? hostAvatar ?? undefined : undefined;

  const aWinning = finished ? state.winner === "A" : state.scoreA > state.scoreB;
  const bWinning = finished ? state.winner === "B" : state.scoreB > state.scoreA;

  return (
    <button
      type="button"
      onClick={onOpen}
      /* Sits flush under the contained PK video block (top-[96px] + h-[38svh]
         in PkDualVideo), not at a fixed pixel offset meant for full-bleed video. */
      className="absolute inset-x-0 top-[calc(96px+38svh+8px)] z-40 mx-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-2.5 py-2 backdrop-blur-xl transition hover:bg-black/55 active:scale-[0.99]"
    >
      {/* Side A */}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Avatar
          name={sideAName}
          src={sideAAvatar}
          size="sm"
          className={cn("h-6 w-6 shrink-0", aWinning && "ring-2 ring-[#F5B93F]")}
        />
        <span
          className={cn(
            "truncate text-[11px] font-black tabular-nums",
            finished ? (aWinning ? "text-[#F5B93F]" : "text-white/50") : "text-white",
          )}
        >
          {formatCoins(state.scoreA)}
        </span>
      </span>

      {/* Center: icon + timer/result */}
      <span className="flex shrink-0 flex-col items-center gap-0.5 px-1">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5B93F]/20 text-[#F5B93F]">
          <Swords className="h-3 w-3" />
        </span>
        {active ? (
          <span className="rounded-full bg-white/10 px-1.5 text-[9px] font-bold tabular-nums text-white/80">
            {formatRemaining(remaining)}
          </span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wide text-[#F5B93F]">
            {state.winner === "DRAW" ? "Draw" : "Result"}
          </span>
        )}
      </span>

      {/* Side B */}
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span
          className={cn(
            "truncate text-[11px] font-black tabular-nums",
            finished ? (bWinning ? "text-[#F5B93F]" : "text-white/50") : "text-white",
          )}
        >
          {formatCoins(state.scoreB)}
        </span>
        <Avatar
          name={sideBName}
          src={sideBAvatar}
          size="sm"
          className={cn("h-6 w-6 shrink-0", bWinning && "ring-2 ring-[#F5B93F]")}
        />
      </span>
    </button>
  );
}
