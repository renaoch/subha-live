// components/GoLiveSetup.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { FilterPicker } from "@/components/FilterPicker";

interface GoLiveSetupProps {
  title: string;
  isAudioRoom: boolean;
  hostAvatar?: string | null;
  /** Selected filter name. Ignored for audio rooms (no camera). */
  filter: string;
  onFilterChange: (name: string) => void;
  /** True when the filter is baked into the published video, so viewers
   * see exactly what the host previews. */
  filterBaked: boolean;
  /** Camera/mic is ready — the Start button unlocks. */
  ready: boolean;
  starting: boolean;
  error?: string;
  onStart: () => void;
  onClose: () => void;
}

/**
 * Full-screen "get ready" layer shown to the host before going live. The
 * live camera preview (LiveVideo) renders underneath; this adds the filter
 * strip and one big Start Live button anchored at the bottom thumb zone.
 */
export function GoLiveSetup({
  title,
  isAudioRoom,
  hostAvatar,
  filter,
  onFilterChange,
  filterBaked,
  ready,
  starting,
  error,
  onStart,
  onClose,
}: GoLiveSetupProps) {
  const disabled = !ready || starting;

  const label = starting
    ? "Going live…"
    : !ready
      ? error
        ? "Camera unavailable"
        : isAudioRoom
          ? "Preparing mic…"
          : "Preparing camera…"
      : "Go Live";

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between">
      {/* Top scrim + bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="relative flex items-start justify-between px-4 pt-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel and leave"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-md transition active:scale-90"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="flex min-w-0 flex-col items-center px-3 pt-1 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Preview
          </span>
          <p className="mt-1.5 max-w-[220px] truncate text-[13px] font-semibold text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
            {title}
          </p>
        </div>

        {/* Spacer to keep the title optically centred */}
        <span className="h-10 w-10" aria-hidden />
      </div>

      {/* Bottom scrim + controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/20 px-4 py-3 text-xs text-red-100">
            {error}
          </div>
        )}

        {isAudioRoom ? (
          <p className="mb-6 text-center text-[14px] text-white/70">
            Your room is ready. Go live when you want guests to join.
          </p>
        ) : (
          <div className="mb-6">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[15px] font-bold text-white">Filter</p>
              <span className="text-[11px] text-white/45">
                {filterBaked ? "Viewers see this" : "Only you see this"}
              </span>
            </div>
            <FilterPicker
              value={filter}
              onChange={onFilterChange}
              sampleSrc={hostAvatar}
            />
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[17px] font-bold text-neutral-950 transition active:scale-[0.98] disabled:bg-white/25 disabled:text-white/60"
        >
          {starting || (!ready && !error) ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]" />
          )}
          {label}
        </button>
      </div>
    </div>
  );
}