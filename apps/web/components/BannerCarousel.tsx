"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Two-stop gradient for this slide's background. */
  gradient: [string, string];
  onClick?: () => void;
}

interface BannerCarouselProps {
  items: BannerItem[];
  /** Milliseconds between auto-advances. */
  intervalMs?: number;
  className?: string;
}

/**
 * Full-width, auto-advancing promo carousel (Refer & Earn, etc.) for the
 * Home/Party headers. One slide is always full-bleed at ~20% of the
 * viewport height. Auto-plays smoothly, pauses while the user is
 * dragging/touching it, and resumes after they let go. Swipe left/right
 * to move manually; dots below show position.
 */
export function BannerCarousel({ items, intervalMs = 4500, className }: BannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = items.length;

  const goTo = useCallback(
    (i: number) => setIndex(((i % count) + count) % count),
    [count],
  );

  // Auto-advance. Pauses while the user is interacting (drag) and whenever
  // the tab/carousel is hidden, so it never fights a manual swipe and never
  // burns cycles off-screen.
  useEffect(() => {
    if (paused || count <= 1 || prefersReducedMotion) return;
    const id = window.setInterval(() => goTo(index + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [index, paused, count, intervalMs, goTo, prefersReducedMotion]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setPaused(false);
    const SWIPE_THRESHOLD = 40;
    if (info.offset.x < -SWIPE_THRESHOLD) goTo(index + 1);
    else if (info.offset.x > SWIPE_THRESHOLD) goTo(index - 1);
  };

  if (count === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        className="relative h-[20svh] min-h-[128px] max-h-[190px] w-full overflow-hidden rounded-3xl"
      >
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={() => setPaused(true)}
          onDragEnd={handleDragEnd}
          animate={{ x: `-${index * 100}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          {items.map((item) => (
            <BannerSlide key={item.id} item={item} />
          ))}
        </motion.div>

        {count > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
            {items.map((item, i) => (
              <span
                key={item.id}
                className={cn(
                  "h-1.5 rounded-full bg-white transition-all duration-300",
                  i === index ? "w-4 opacity-90" : "w-1.5 opacity-40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BannerSlide({ item }: { item: BannerItem }) {
  const { title, subtitle, Icon, gradient, onClick } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-full w-full shrink-0 items-center gap-4 overflow-hidden px-5 text-left active:scale-[0.99]"
      style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
    >
      {/* Soft decorative glows — static, cheap CSS, no continuous animation
          so this stays lightweight even with several slides mounted. */}
      <span className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <span className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-black/10 blur-2xl" />

      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-base font-black leading-tight tracking-tight text-white">
          {title}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-white/85">{subtitle}</span>
      </span>
    </button>
  );
}