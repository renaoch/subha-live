"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck2, Gift, Sparkles, Wallet } from "lucide-react";

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
        className="relative h-[190px] min-h-[168px] w-full overflow-hidden rounded-[28px] border border-accent-hot/30 bg-[linear-gradient(145deg,rgba(64,31,8,0.92),rgba(24,12,4,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_50px_-28px_rgba(255,140,0,0.45)] sm:h-[200px]"
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
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
            {items.map((item, i) => (
              <span
                key={item.id}
                className={cn(
                  "h-2 rounded-full bg-white transition-all duration-300",
                  i === index ? "w-8 opacity-90" : "w-2 opacity-35",
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
  const { title, subtitle, Icon, onClick } = item;
  const isDaily = item.id === "daily-rewards";
  const isRefer = item.id === "refer-earn";
  const RightIcon = isDaily ? CalendarCheck2 : isRefer ? Gift : Wallet;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-full w-full shrink-0 items-center overflow-hidden px-7 pb-8 pt-5 text-left active:scale-[0.995] sm:px-8"
      style={{
        background:
          "radial-gradient(circle at 86% 58%, rgba(255,145,34,0.14), transparent 23%), linear-gradient(135deg, rgba(72,35,9,0.94), rgba(27,14,6,0.98) 58%, rgba(18,9,4,0.99))",
      }}
    >
      <span className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-accent-gold/10 blur-3xl" />
      <span className="pointer-events-none absolute right-[-3.5rem] top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-accent-hot/10 blur-3xl" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-black/10" />

      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-gold/10 shadow-[0_0_28px_rgba(255,156,44,0.13)] sm:h-24 sm:w-24">
        <Icon className="h-7 w-7 text-white sm:h-11 sm:w-11" strokeWidth={1.8} />
        <span className="pointer-events-none absolute inset-2 rounded-full border border-accent-gold/20" />
      </span>

      <span className="relative z-10 min-w-0 flex-1 pl-4 sm:pl-8">
        <span className="block font-display text-[clamp(1.15rem,2.7vw,1.7rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">
          {title}
        </span>
        <span className="mt-2 block text-[clamp(0.82rem,1.8vw,1.05rem)] font-medium leading-relaxed text-white/70">
          {subtitle}
        </span>
      </span>

      <span className="pointer-events-none relative mr-0 flex h-20 w-20 shrink-0 items-center justify-center sm:mr-5 sm:h-36 sm:w-36">
        <span className="absolute inset-2 rounded-[26px] border-2 border-accent-hot/70 shadow-[0_0_30px_rgba(255,135,22,0.24),inset_0_0_18px_rgba(255,135,22,0.08)]" />
        <span className="absolute -right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent-hot shadow-[0_0_12px_rgba(255,145,34,0.95)]" />
        <span className="absolute -left-1 top-8 h-2.5 w-2.5 rounded-full bg-accent-hot shadow-[0_0_12px_rgba(255,145,34,0.95)]" />
        <span className="absolute left-3 top-0 h-7 w-2 rounded-full bg-accent-hot/80 shadow-[0_0_12px_rgba(255,145,34,0.35)]" />
        <span className="absolute left-11 top-0 h-7 w-2 rounded-full bg-accent-hot/80 shadow-[0_0_12px_rgba(255,145,34,0.35)]" />
        <span className="absolute right-3 top-0 h-7 w-2 rounded-full bg-accent-hot/80 shadow-[0_0_12px_rgba(255,145,34,0.35)]" />
        <RightIcon className="h-10 w-10 text-accent-hot sm:h-16 sm:w-16" strokeWidth={1.55} />
        <span className="absolute left-1/2 top-[56%] h-1 w-10 -translate-x-1/2 rotate-[-35deg] rounded-full bg-accent-hot/80 sm:w-11" />
        <span className="absolute left-[56%] top-[58%] h-1 w-7 rotate-[48deg] rounded-full bg-accent-hot/80 sm:w-8" />
      </span>
    </button>
  );
}
