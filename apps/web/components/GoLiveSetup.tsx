// components/GoLiveSetup.tsx
"use client";

import { Eye, Loader2, Mic, Radio, Sparkles, X } from "lucide-react";
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
      : "Start Live";

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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
      <div className="relative px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-300/25 bg-red-950/60 px-4 py-3 text-xs text-red-100 backdrop-blur-xl">
            {error}
          </div>
        )}

        {isAudioRoom ? (
          <div className="mb-4 flex items-center gap-3 rounded-[26px] border border-white/10 bg-white/[0.07] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-gold/90 to-accent-hot text-white">
              <Mic className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white">Your room is ready</p>
              <p className="text-[12px] leading-snug text-white/60">
                Tap below when you want guests to join.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-[26px] border border-white/10 bg-white/[0.07] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[14px] font-bold text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-accent-gold to-accent-hot">
                  <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
                </span>
                Filters
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-white/70">
                <Eye className="h-3 w-3" />
                {filterBaked ? "Viewers see this" : "Only on this device"}
              </span>
            </div>
            <FilterPicker
              value={filter}
              onChange={onFilterChange}
              sampleSrc={hostAvatar}
            />
          </div>
        )}

        {/* The big one */}
        <div className="relative">
          {!disabled && (
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-accent-hot/20 [animation-duration:2.4s]"
            />
          )}
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="grad-brand animate-gradient-shift glow-hot-lg relative isolate flex h-[60px] w-full items-center justify-center gap-3 overflow-hidden rounded-full text-[17px] font-extrabold tracking-tight text-white ring-1 ring-inset ring-white/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent"
            />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              {starting || (!ready && !error) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Radio className="h-4 w-4" strokeWidth={2.4} />
              )}
            </span>
            <span className="relative">{label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}