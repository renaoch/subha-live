// components/FilterPicker.tsx
"use client";

import { CAMERA_FILTERS } from "@/lib/camera-filters";
import { cn } from "@/lib/utils";

interface FilterPickerProps {
  value: string;
  onChange: (name: string) => void;
  /** Kept for backwards compatibility. Swatches are colour-coded now, so
   * every filter is visibly different instead of repeating one photo. */
  sampleSrc?: string | null;
  size?: "md" | "sm";
  className?: string;
}

// One distinct, readable colour per filter. These only *represent* the look
// in the picker; the real effect is shown on the live camera preview.
const SWATCH: Record<string, string> = {
  Natural: "linear-gradient(135deg,#f5f5f4 0%,#a8a29e 100%)",
  Glow: "linear-gradient(135deg,#fff3b0 0%,#ffb86b 100%)",
  Warm: "linear-gradient(135deg,#ffb347 0%,#ff6a3d 100%)",
  Cool: "linear-gradient(135deg,#7dd3fc 0%,#4f6bff 100%)",
  Fresh: "linear-gradient(135deg,#a7f3a0 0%,#14b8a6 100%)",
  Rose: "linear-gradient(135deg,#ffb3c7 0%,#ec4899 100%)",
  Vintage: "linear-gradient(135deg,#d8b98a 0%,#8a6a45 100%)",
  Noir: "linear-gradient(135deg,#6b7280 0%,#0a0a0a 100%)",
};
const FALLBACK = "linear-gradient(135deg,#a78bfa 0%,#6366f1 100%)";

/**
 * Horizontal strip of colour-coded filter swatches. Tap one and the live
 * camera preview behind the sheet changes immediately.
 */
export function FilterPicker({
  value,
  onChange,
  size = "md",
  className,
}: FilterPickerProps) {
  const dim = size === "md" ? "h-14 w-14" : "h-10 w-10";

  return (
    <div
      role="radiogroup"
      aria-label="Camera filter"
      className={cn(
        "-mx-5 flex gap-4 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {CAMERA_FILTERS.map((filter) => {
        const selected = value === filter.name;
        return (
          <button
            key={filter.name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(filter.name)}
            className="flex shrink-0 flex-col items-center gap-2 active:scale-95"
          >
            <span
              className={cn(
                "block rounded-full transition-all duration-200",
                dim,
                selected
                  ? "scale-110 ring-[3px] ring-white ring-offset-2 ring-offset-black/60"
                  : "opacity-80 ring-1 ring-white/20",
              )}
              style={{ backgroundImage: SWATCH[filter.name] ?? FALLBACK }}
            />
            <span
              className={cn(
                "text-[12px] leading-none transition-colors",
                selected ? "font-bold text-white" : "font-medium text-white/50",
              )}
            >
              {filter.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}