"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck2, Gift, Wallet } from "lucide-react";

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
 * Compact, auto-advancing promo carousel for the Home/Party headers.
 *
 * Designed to take up less vertical space on mobile while preserving
 * the existing dark/orange Subha visual language.
 *
 * Supports:
 * - Automatic slide advancement
 * - Swipe left/right
 * - Reduced-motion preference
 * - Pause while dragging
 * - Responsive sizing
 * - Pagination dots
 */
export function BannerCarousel({
  items,
  intervalMs = 4500,
  className,
}: BannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = items.length;

  const goTo = useCallback(
    (i: number) => {
      if (count === 0) return;

      setIndex(((i % count) + count) % count);
    },
    [count],
  );

  // Auto advance
  useEffect(() => {
    if (paused || count <= 1 || prefersReducedMotion) return;

    const id = window.setInterval(() => {
      goTo(index + 1);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [
    index,
    paused,
    count,
    intervalMs,
    goTo,
    prefersReducedMotion,
  ]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    setPaused(false);

    const SWIPE_THRESHOLD = 40;

    if (info.offset.x < -SWIPE_THRESHOLD) {
      goTo(index + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      goTo(index - 1);
    }
  };

  if (count === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        className="
          relative
          h-[140px]
          min-h-[140px]
          w-full
          overflow-hidden
          rounded-[24px]
          border
          border-accent-hot/30
          bg-[linear-gradient(145deg,rgba(64,31,8,0.92),rgba(24,12,4,0.96))]
          shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_50px_-28px_rgba(255,140,0,0.45)]
          sm:h-[155px]
          sm:min-h-[155px]
        "
      >
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={() => setPaused(true)}
          onDragEnd={handleDragEnd}
          animate={{
            x: `-${index * 100}%`,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 32,
          }}
        >
          {items.map((item) => (
            <BannerSlide
              key={item.id}
              item={item}
            />
          ))}
        </motion.div>

        {/* Pagination */}
        {count > 1 && (
          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-2.5
              z-10
              flex
              items-center
              justify-center
              gap-1.5
            "
          >
            {items.map((item, i) => (
              <span
                key={item.id}
                className={cn(
                  "h-1.5 rounded-full bg-white transition-all duration-300",
                  i === index
                    ? "w-6 opacity-90"
                    : "w-1.5 opacity-35",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BannerSlide({
  item,
}: {
  item: BannerItem;
}) {
  const {
    title,
    subtitle,
    Icon,
    onClick,
  } = item;

  const isDaily = item.id === "daily-rewards";
  const isRefer = item.id === "refer-earn";

  const RightIcon = isDaily
    ? CalendarCheck2
    : isRefer
      ? Gift
      : Wallet;

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        relative
        flex
        h-full
        w-full
        shrink-0
        items-center
        overflow-hidden
        px-5
        pb-6
        pt-4
        text-left
        active:scale-[0.995]
        sm:px-7
      "
      style={{
        background:
          "radial-gradient(circle at 86% 58%, rgba(255,145,34,0.14), transparent 23%), linear-gradient(135deg, rgba(72,35,9,0.94), rgba(27,14,6,0.98) 58%, rgba(18,9,4,0.99))",
      }}
    >
      {/* Background glow - left */}
      <span
        className="
          pointer-events-none
          absolute
          -left-12
          -top-16
          h-32
          w-32
          rounded-full
          bg-accent-gold/10
          blur-3xl
        "
      />

      {/* Background glow - right */}
      <span
        className="
          pointer-events-none
          absolute
          right-[-3rem]
          top-1/2
          h-44
          w-44
          -translate-y-1/2
          rounded-full
          bg-accent-hot/10
          blur-3xl
        "
      />

      {/* Bottom shade */}
      <span
        className="
          pointer-events-none
          absolute
          inset-x-0
          bottom-0
          h-10
          bg-black/10
        "
      />

      {/* Left icon */}
      <span
        className="
          relative
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-accent-gold/10
          shadow-[0_0_24px_rgba(255,156,44,0.13)]
          sm:h-16
          sm:w-16
        "
      >
        <Icon
          className="
            h-6
            w-6
            text-white
            sm:h-8
            sm:w-8
          "
          strokeWidth={1.8}
        />

        <span
          className="
            pointer-events-none
            absolute
            inset-1.5
            rounded-full
            border
            border-accent-gold/20
          "
        />
      </span>

      {/* Text */}
      <span
        className="
          relative
          z-10
          min-w-0
          flex-1
          pl-3
          sm:pl-5
        "
      >
        <span
          className="
            block
            font-display
            text-[clamp(1rem,2.5vw,1.45rem)]
            font-extrabold
            leading-tight
            tracking-[-0.02em]
            text-white
          "
        >
          {title}
        </span>

        <span
          className="
            mt-1
            block
            text-[clamp(0.75rem,1.7vw,0.95rem)]
            font-medium
            leading-snug
            text-white/70
          "
        >
          {subtitle}
        </span>
      </span>

      {/* Right illustration/icon */}
      <span
        className="
          pointer-events-none
          relative
          mr-0
          flex
          h-16
          w-16
          shrink-0
          items-center
          justify-center
          sm:mr-4
          sm:h-24
          sm:w-24
        "
      >
        {/* Outer rounded frame */}
        <span
          className="
            absolute
            inset-1.5
            rounded-[20px]
            border
            border-accent-hot/70
            shadow-[0_0_24px_rgba(255,135,22,0.20),inset_0_0_14px_rgba(255,135,22,0.08)]
            sm:inset-2
            sm:rounded-[24px]
          "
        />

        {/* Decorative dots */}
        <span
          className="
            absolute
            -right-0.5
            top-0.5
            h-2
            w-2
            rounded-full
            bg-accent-hot
            shadow-[0_0_10px_rgba(255,145,34,0.95)]
          "
        />

        <span
          className="
            absolute
            -left-0.5
            top-6
            h-2
            w-2
            rounded-full
            bg-accent-hot
            shadow-[0_0_10px_rgba(255,145,34,0.95)]
          "
        />

        {/* Calendar / gift decorative bars */}
        <span
          className="
            absolute
            left-2
            top-0
            h-5
            w-1.5
            rounded-full
            bg-accent-hot/80
            shadow-[0_0_10px_rgba(255,145,34,0.35)]
            sm:left-3
            sm:h-6
          "
        />

        <span
          className="
            absolute
            left-8
            top-0
            h-5
            w-1.5
            rounded-full
            bg-accent-hot/80
            shadow-[0_0_10px_rgba(255,145,34,0.35)]
            sm:left-10
            sm:h-6
          "
        />

        <span
          className="
            absolute
            right-2
            top-0
            h-5
            w-1.5
            rounded-full
            bg-accent-hot/80
            shadow-[0_0_10px_rgba(255,145,34,0.35)]
            sm:right-3
            sm:h-6
          "
        />

        <RightIcon
          className="
            h-8
            w-8
            text-accent-hot
            sm:h-11
            sm:w-11
          "
          strokeWidth={1.55}
        />

        {/* Decorative crossing lines */}
        <span
          className="
            absolute
            left-1/2
            top-[56%]
            h-1
            w-8
            -translate-x-1/2
            rotate-[-35deg]
            rounded-full
            bg-accent-hot/80
            sm:w-10
          "
        />

        <span
          className="
            absolute
            left-[56%]
            top-[58%]
            h-1
            w-6
            rotate-[48deg]
            rounded-full
            bg-accent-hot/80
            sm:w-7
          "
        />
      </span>
    </button>
  );
}