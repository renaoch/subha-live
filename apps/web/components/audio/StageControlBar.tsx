"use client";

// Bottom control bar for audio party rooms. Shows the right action for the
// current user's stage state: host → mute + manage seats; seated speaker →
// mute + leave seat; listener → request / cancel request to speak. Mute is
// reported to the server via reportStage so the stage badge is authoritative.

import { Layers, Loader2, Mic, MicOff, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageControlBarProps {
  isHost: boolean;
  isLive: boolean;
  mySeat: number | null;
  requestPending: boolean;
  muted: boolean;
  loading: boolean;
  pendingCount?: number;
  onToggleMute: () => void;
  onLeaveSeat: () => void;
  onRequest: () => void;
  onCancelRequest: () => void;
  onManage: () => void;
  onOpenLevels: () => void;
}

// Vertical glass rail pinned to the top-right (under the room header) so the
// bottom of the screen stays free for chat. Each action = icon + tiny label.
function RailButton({
  label,
  aria,
  onClick,
  disabled,
  tone = "plain",
  badge,
  children,
}: {
  label: string;
  aria: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "light" | "danger" | "gold" | "hot";
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="group flex w-[52px] flex-col items-center gap-1 transition active:scale-90 disabled:opacity-50"
    >
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-xl transition",
          tone === "plain" && "border-white/15 bg-white/10 text-white group-hover:bg-white/20",
          tone === "light" && "border-white bg-white text-black",
          tone === "danger" && "border-rose-400/30 bg-rose-500/20 text-rose-300 group-hover:bg-rose-500/30",
          tone === "gold" && "border-[#F5C96A]/40 bg-[#F5C96A]/20 text-[#FFE29A] group-hover:bg-[#F5C96A]/30",
          tone === "hot" && "border-transparent bg-gradient-to-br from-[#FFB04A] to-[#FF5A5F] text-white shadow-[0_4px_18px_rgba(255,106,61,0.5)]",
        )}
      >
        {children}
        {!!badge && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B5C] px-1 text-[9px] font-bold text-white ring-2 ring-[#170F2E]">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[9px] font-bold leading-none text-white/75 drop-shadow">{label}</span>
    </button>
  );
}

export function StageControlBar({
  isHost,
  isLive,
  mySeat,
  requestPending,
  muted,
  loading,
  pendingCount,
  onToggleMute,
  onLeaveSeat,
  onRequest,
  onCancelRequest,
  onManage,
  onOpenLevels,
}: StageControlBarProps) {
  const onStage = isHost || mySeat !== null;

  if (!isLive) return null;

  return (
    <div className="pointer-events-auto absolute right-2 top-[118px] z-30 flex flex-col items-center gap-2.5 rounded-[26px] border border-white/10 bg-black/35 px-1 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      {onStage && (
        <RailButton
          label={muted ? "Unmute" : "Mute"}
          aria={muted ? "Unmute microphone" : "Mute microphone"}
          onClick={onToggleMute}
          tone={muted ? "light" : "plain"}
        >
          {muted ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </RailButton>
      )}

      {isHost && (
        <RailButton label="Manage" aria="Manage seats" onClick={onManage} tone="gold" badge={pendingCount}>
          <Users className="h-[18px] w-[18px]" />
        </RailButton>
      )}

      {onStage && (
        <RailButton label={isHost ? "End" : "Leave"} aria={isHost ? "Leave stage" : "Leave seat"} onClick={onLeaveSeat} tone="danger">
          <PhoneOff className="h-[18px] w-[18px]" />
        </RailButton>
      )}

      {!onStage && !requestPending && (
        <RailButton label="Speak" aria="Request to speak" onClick={onRequest} disabled={loading} tone="hot">
          <Mic className="h-[18px] w-[18px]" />
        </RailButton>
      )}

      {!onStage && requestPending && (
        <RailButton label="Cancel" aria="Cancel request to speak" onClick={onCancelRequest}>
          <Loader2 className="h-[18px] w-[18px] animate-spin text-[#E8C27A]" />
        </RailButton>
      )}

      <span className="h-px w-7 bg-white/10" />

      <RailButton label="Seats" aria="Seat levels and unlock coins" onClick={onOpenLevels}>
        <Layers className="h-[18px] w-[18px]" />
      </RailButton>
    </div>
  );
}