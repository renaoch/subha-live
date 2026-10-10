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
 * Horizontal, scrollable strip of filter cards. Each card is
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
  const dim = size === "md" ? "h-[104px] w-[78px]" : "h-[76px] w-[58px]";

  return (
    <div
      role="radiogroup"
      aria-label="Camera filter"
      className={cn(
        "-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
            className={cn(
              "group relative shrink-0 snap-start overflow-hidden rounded-[18px] transition-all duration-200 active:scale-95",
              dim,
              selected
                ? "scale-[1.03] shadow-[0_8px_22px_-6px_hsl(var(--accent-hot)/0.7)] ring-2 ring-accent-gold"
                : "ring-1 ring-inset ring-white/12 hover:ring-white/30",
            )}
          >
            {sampleSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sampleSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: cameraFilterCss(filter.name) }}
              />
            ) : (
              <span
                className="absolute inset-0 block"
                style={{
                  backgroundImage: SAMPLE_SCENE,
                  filter: cameraFilterCss(filter.name),
                }}
              />
            )}

            {/* Bottom fade so the label always reads */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent transition-opacity",
                selected ? "from-black/80" : "from-black/70 opacity-90",
              )}
            />
            {!selected && (
              <span
                aria-hidden
                className="absolute inset-0 bg-black/20 transition-opacity group-hover:opacity-0"
              />
            )}

            {selected && (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-accent-gold to-accent-hot shadow-md">
                <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
              </span>
            )}

            <span
              className={cn(
                "absolute inset-x-0 bottom-2 text-center text-[11px] leading-none tracking-tight",
                selected ? "font-extrabold text-white" : "font-semibold text-white/75",
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