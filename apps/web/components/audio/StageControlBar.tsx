"use client";

// Bottom control bar for audio party rooms. Shows the right action for the
// current user's stage state: host → mute + manage seats; seated speaker →
// mute + leave seat; listener → request / cancel request to speak. Mute is
// reported to the server via reportStage so the stage badge is authoritative.

import { Loader2, Mic, MicOff, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageControlBarProps {
  isHost: boolean;
  isLive: boolean;
  mySeat: number | null;
  requestPending: boolean;
  muted: boolean;
  loading: boolean;
  onToggleMute: () => void;
  onLeaveSeat: () => void;
  onRequest: () => void;
  onCancelRequest: () => void;
  onManage: () => void;
}

export function StageControlBar({
  isHost,
  isLive,
  mySeat,
  requestPending,
  muted,
  loading,
  onToggleMute,
  onLeaveSeat,
  onRequest,
  onCancelRequest,
  onManage,
}: StageControlBarProps) {
  const onStage = isHost || mySeat !== null;

  if (!isLive) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-[78px] z-30 flex justify-center">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {onStage && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90",
              muted ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        {onStage && (
          <button
            type="button"
            onClick={onLeaveSeat}
            aria-label="Leave seat"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25 active:scale-90"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        )}

        {isHost && (
          <button
            type="button"
            onClick={onManage}
            aria-label="Manage seats"
            className="flex items-center gap-1.5 rounded-full bg-[#F5C96A]/15 px-3.5 py-2 text-xs font-bold text-[#F5C96A] transition hover:bg-[#F5C96A]/25 active:scale-95"
          >
            <Users className="h-4 w-4" />
            Manage
          </button>
        )}

        {!onStage && !requestPending && (
          <button
            type="button"
            onClick={onRequest}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--accent-hot))] to-[#FF6B4A] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_20px_hsl(var(--shadow-color)/0.5)] transition active:scale-95 disabled:opacity-50"
          >
            <Mic className="h-4 w-4" />
            Request to speak
          </button>
        )}

        {!onStage && requestPending && (
          <button
            type="button"
            onClick={onCancelRequest}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/15 active:scale-95"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E8C27A]" />
            Request pending · Cancel
          </button>
        )}
      </div>
    </div>
  );
}
