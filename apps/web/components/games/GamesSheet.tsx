// components/games/GamesSheet.tsx
//
// The in-room "Games" launcher. Lists the available games (currently Subha
// Lucky) and opens the selected game on top of the live room.

"use client";

import { useEffect } from "react";
import { X, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuckySymbol } from "@/components/games/LuckySymbol";

interface GamesSheetProps {
  open: boolean;
  onClose: () => void;
  onPlayLucky: () => void;
}

export function GamesSheet({ open, onClose, onPlayLucky }: GamesSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Games"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-[28px] border-t border-white/10 bg-[#141118]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-transform duration-250 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />

        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-bold text-white">
            <Sparkles className="h-4 w-4 text-[#F5B93F]" />
            Games
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onPlayLucky}
          className="group flex w-full items-center gap-3 rounded-2xl border border-[#F5B93F]/25 bg-gradient-to-r from-[#2a1b2e] to-[#1a1120] p-3 text-left transition hover:border-[#F5B93F]/50 active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/40 ring-1 ring-white/10">
            <LuckySymbol id="lucky" size={44} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-white">Subha Lucky</span>
            <span className="mt-0.5 block text-xs text-white/50">
              3×3 luck game — match fruit to win coins
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition group-hover:text-white" />
        </button>
      </div>
    </>
  );
}
