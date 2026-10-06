// components/RoomMoreActions.tsx
"use client";

import { useEffect } from "react";
import {
  ChevronLeft,
  Layers,
  Link2,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SeatLevelsPanel } from "@/components/audio/SeatLevelsPanel";

export interface RoomAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean; // visually "on" (white fill) — e.g. mic muted
  tone?: "plain" | "gold" | "danger" | "hot";
  badge?: number;
  disabled?: boolean;
  keepOpen?: boolean; // don't close the sheet after tapping
}

/** Party-room (audio stage) controls shown at the top of the sheet. */
export interface StageMenuProps {
  onStage: boolean;
  isHost: boolean;
  muted: boolean;
  requestPending: boolean;
  loading: boolean;
  pendingCount: number;
  roomCoins: number;
  seatCount: number;
  onToggleMute: () => void;
  onLeaveSeat: () => void;
  onRequest: () => void;
  onCancelRequest: () => void;
  onManage: () => void;
}

interface RoomMoreActionsProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  onShare?: () => void;
  isAudioRoom?: boolean;
  /** Only passed for live audio party rooms. */
  stage?: StageMenuProps;
  view?: "menu" | "levels";
  onViewChange?: (v: "menu" | "levels") => void;
}

/**
 * Bottom sheet opened from the burger in the chat bar. In party rooms it holds
 * the stage controls (mute, manage, leave, request to speak), the seat-levels
 * view (coins needed per seat tier) and Share link.
 */
export function RoomMoreActions({
  open,
  onClose,
  onShare,
  stage,
  view = "menu",
  onViewChange,
}: RoomMoreActionsProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const actions: RoomAction[] = [];

  if (stage) {
    if (stage.onStage) {
      actions.push({
        key: "mute",
        label: stage.muted ? "Unmute" : "Mute",
        icon: stage.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />,
        onClick: stage.onToggleMute,
        active: stage.muted,
        keepOpen: true,
      });
    }
    if (stage.isHost) {
      actions.push({
        key: "manage",
        label: "Manage",
        icon: <Users className="h-5 w-5" />,
        onClick: stage.onManage,
        tone: "gold",
        badge: stage.pendingCount,
      });
    }
    if (stage.onStage) {
      actions.push({
        key: "leave",
        label: stage.isHost ? "End" : "Leave seat",
        icon: <PhoneOff className="h-5 w-5" />,
        onClick: stage.onLeaveSeat,
        tone: "danger",
      });
    } else if (stage.requestPending) {
      actions.push({
        key: "cancel",
        label: "Cancel request",
        icon: <Loader2 className="h-5 w-5 animate-spin" />,
        onClick: stage.onCancelRequest,
      });
    } else {
      actions.push({
        key: "request",
        label: "Request to speak",
        icon: <Mic className="h-5 w-5" />,
        onClick: stage.onRequest,
        tone: "hot",
        disabled: stage.loading,
      });
    }
    actions.push({
      key: "seats",
      label: "Seat levels",
      icon: <Layers className="h-5 w-5" />,
      onClick: () => onViewChange?.("levels"),
      keepOpen: true,
    });
  }

  actions.push({
    key: "share",
    label: "Share link",
    icon: <Link2 className="h-5 w-5" />,
    onClick: onShare,
  });

  const showLevels = !!stage && view === "levels";

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={showLevels ? "Seat levels" : "More actions"}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/10 bg-[linear-gradient(180deg,#2A1650_0%,#1A1030_40%,#120C22_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] transition-transform duration-250 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Grabber */}
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />

        <div className="mb-3 flex items-center justify-between">
          {showLevels ? (
            <button
              type="button"
              onClick={() => onViewChange?.("menu")}
              className="flex items-center gap-1 text-[15px] font-extrabold text-white"
            >
              <ChevronLeft className="h-5 w-5" />
              Seat levels
            </button>
          ) : (
            <span className="text-[15px] font-extrabold text-white">
              {stage ? "Party controls" : "More"}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showLevels && stage ? (
          <div className="max-h-[68vh] overflow-y-auto pb-2">
            <SeatLevelsPanel roomCoins={stage.roomCoins} seatCount={stage.seatCount} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 pb-1">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  a.onClick?.();
                  if (!a.keepOpen) onClose();
                }}
                disabled={a.disabled}
                className="flex flex-col items-center gap-1.5 transition active:scale-90 disabled:opacity-40"
              >
                <span
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-2xl border transition",
                    a.active && "border-white bg-white text-black",
                    !a.active && (a.tone ?? "plain") === "plain" && "border-white/10 bg-white/[0.08] text-white",
                    !a.active && a.tone === "gold" && "border-[#F5C96A]/40 bg-[#F5C96A]/20 text-[#FFE29A]",
                    !a.active && a.tone === "danger" && "border-rose-400/30 bg-rose-500/20 text-rose-300",
                    !a.active && a.tone === "hot" && "border-transparent bg-gradient-to-br from-[#FFB04A] to-[#FF5A5F] text-white shadow-[0_4px_18px_rgba(255,106,61,0.5)]",
                  )}
                >
                  {a.icon}
                  {!!a.badge && a.badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B5C] px-1 text-[9px] font-bold text-white ring-2 ring-[#1A1030]">
                      {a.badge}
                    </span>
                  )}
                </span>
                <span className="text-center text-[10.5px] font-semibold leading-tight text-white/80">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}