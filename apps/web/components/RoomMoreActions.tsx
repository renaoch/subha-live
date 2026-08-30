// components/RoomMoreActions.tsx
"use client";

import { useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Link2,
  Menu,
  ThumbsUp,
  Swords,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoomAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean; // visually "on" (white fill) — e.g. mic muted, camera off
  disabled?: boolean;
  comingSoon?: boolean;
}

interface RoomMoreActionsProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  micEnabled?: boolean;
  onToggleMic?: () => void;
  cameraEnabled?: boolean;
  onToggleCamera?: () => void;
  onShare?: () => void;
  onOpenMenu?: () => void;
  onLike?: () => void;
  onOpenPk?: () => void;
}

/**
 * Bottom sheet of secondary room actions (mic, camera, share, menu, like,
 * PK battles). Keeps the primary chat bar uncluttered — this is where
 * everything that isn't "type a message" or "send a gift" lives.
 */
export function RoomMoreActions({
  open,
  onClose,
  isHost,
  micEnabled = true,
  onToggleMic,
  cameraEnabled = true,
  onToggleCamera,
  onShare,
  onOpenMenu,
  onLike,
  onOpenPk,
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

  const actions: RoomAction[] = [
    ...(isHost
      ? [
          {
            key: "mic",
            label: micEnabled ? "Mute" : "Unmute",
            icon: micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />,
            onClick: onToggleMic,
            active: !micEnabled,
          },
          {
            key: "camera",
            label: cameraEnabled ? "Hide video" : "Show video",
            icon: cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />,
            onClick: onToggleCamera,
            active: !cameraEnabled,
          },
        ]
      : []),
    {
      key: "pk",
      label: "PK Battle",
      icon: <Swords className="h-5 w-5" />,
      onClick: onOpenPk,
      comingSoon: !onOpenPk,
    },
    {
      key: "share",
      label: "Share link",
      icon: <Link2 className="h-5 w-5" />,
      onClick: onShare,
    },
    {
      key: "like",
      label: "Like",
      icon: <ThumbsUp className="h-5 w-5" />,
      onClick: onLike,
    },
    {
      key: "menu",
      label: "Menu",
      icon: <Menu className="h-5 w-5" />,
      onClick: onOpenMenu,
    },
  ];

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
        aria-label="More actions"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/10 bg-[#141418]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-transform duration-250 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Grabber */}
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white/90">More</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-y-4 pb-1">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                if (a.comingSoon) return;
                a.onClick?.();
                onClose();
              }}
              disabled={a.disabled}
              className="flex flex-col items-center gap-1.5 disabled:opacity-40"
            >
              <span
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 transition",
                  a.active ? "bg-white text-black" : "bg-white/[0.06] text-white",
                )}
              >
                {a.icon}
                {a.comingSoon && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[#FF3B5C] px-1.5 py-[1px] text-[8px] font-bold leading-tight text-white">
                    soon
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-medium text-white/70">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}