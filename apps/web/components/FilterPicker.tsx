// components/FilterPicker.tsx
"use client";

import { Check } from "lucide-react";
import { CAMERA_FILTERS, cameraFilterCss } from "@/lib/camera-filters";
import { cn } from "@/lib/utils";

interface FilterPickerProps {
  value: string;
  onChange: (name: string) => void;
  /** Optional image (e.g. the host's avatar) used as the sample in each
   * thumbnail so the effect reads clearly. Falls back to a colour scene. */
  sampleSrc?: string | null;
  size?: "md" | "sm";
  className?: string;
}

// Neutral "portrait-ish" scene so the thumbnails show a filter's colour
// character even when the host has no avatar.
const SAMPLE_SCENE =
  "radial-gradient(circle at 50% 38%, #f6c9a8 0 22%, transparent 23%), " +
  "linear-gradient(160deg, #7cc4ff 0%, #ffd27a 55%, #ff7a9a 100%)";

/**
 * Horizontal, scrollable strip of filter thumbnails. Each thumbnail is
 * rendered with the exact CSS equivalent of the filter that gets baked
 * into the outgoing video (see lib/camera-filters.ts), so what you tap is
 * what viewers get.
 */
export function FilterPicker({
  value,
  onChange,
  sampleSrc,
  size = "md",
  className,
}: FilterPickerProps) {
  const dim = size === "md" ? "h-[64px] w-[64px]" : "h-[46px] w-[46px]";

  return (
    <div
      role="radiogroup"
      aria-label="Camera filter"
      className={cn(
        "-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
                "relative block shrink-0 rounded-full transition-all duration-200",
                dim,
                selected && "p-[2.5px] bg-[linear-gradient(135deg,hsl(var(--accent-gold)),hsl(var(--accent-hot)))] shadow-[0_0_0_1px_hsl(var(--accent-hot)/0.25),0_6px_18px_-4px_hsl(var(--shadow-color)/0.75)]",
              )}
            >
              <span
                className={cn(
                  "relative block h-full w-full overflow-hidden rounded-full",
                  !selected && "ring-1 ring-inset ring-white/15",
                )}
              >
                {sampleSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sampleSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ filter: cameraFilterCss(filter.name) }}
                  />
                ) : (
                  <span
                    className="block h-full w-full"
                    style={{
                      backgroundImage: SAMPLE_SCENE,
                      filter: cameraFilterCss(filter.name),
                    }}
                  />
                )}
                {!selected && (
                  <span className="pointer-events-none absolute inset-0 bg-black/25 transition-opacity group-hover:bg-black/10" />
                )}
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 shadow-sm">
                      <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
                    </span>
                  </span>
                )}
              </span>
            </span>
            <span
              className={cn(
                "text-[11px] leading-none tracking-tight transition-colors",
                selected ? "font-bold text-white" : "font-medium text-white/55",
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