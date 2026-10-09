'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroSlide {
  id: string;
  /** First headline line (white). */
  title: string;
  /** Second headline line (italic, orange gradient). */
  highlight: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  /** Photo on the right. When absent, `Icon` is drawn as glowing art instead. */
  image?: string;
  /** CSS object-position for the photo, e.g. "75% 20%". */
  imagePosition?: string;
  Icon?: LucideIcon;
}

interface HeroBannerCarouselProps {
  slides: HeroSlide[];
  intervalMs?: number;
  className?: string;
}

/*
 * Hero banner: dark left fade, photo/art on the right, two-line headline,
 * glowing CTA pill and pagination dots.
 *
 * All sizes are in `cqw` (1% of the banner's own width), measured from the
 * design reference, so the banner scales identically on every phone width.
 */
export function HeroBannerCarousel({
  slides,
  intervalMs = 5500,
  className,
}: HeroBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = slides.length;

  const goTo = useCallback(
    (i: number) => {
      if (count === 0) return;
      setIndex(((i % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count <= 1 || reduceMotion) return;
    const id = window.setInterval(() => goTo(index + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [index, paused, count, intervalMs, goTo, reduceMotion]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setPaused(false);
    if (info.offset.x < -40) goTo(index + 1);
    else if (info.offset.x > 40) goTo(index - 1);
  };

  if (count === 0) return null;

  return (
    <div className={cn('w-full', className)}>
      {/* Gradient border: 1px padding around the clipped card */}
      <div className="rounded-[28px] bg-gradient-to-br from-orange-400/80 via-orange-500/25 to-fuchsia-400/60 p-px shadow-[0_18px_50px_-24px_rgba(255,140,0,0.55)]">
        <div className="@container relative aspect-[2.08/1] w-full overflow-hidden rounded-[27px] bg-[#0b0806]">
          <motion.div
            className="flex h-full"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragStart={() => setPaused(true)}
            onDragEnd={onDragEnd}
            animate={{ x: `-${index * 100}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            {slides.map((slide) => (
              <Slide key={slide.id} slide={slide} />
            ))}
          </motion.div>

          {count > 1 && (
            <div className="absolute inset-x-0 bottom-[3.2cqw] z-20 flex items-center justify-center gap-[1.4cqw]">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  className={cn(
                    'h-[1.6cqw] rounded-full transition-all duration-300',
                    i === index ? 'w-[6.2cqw] bg-white/90' : 'w-[1.6cqw] bg-white/35',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Slide({ slide }: { slide: HeroSlide }) {
  const { title, highlight, subtitle, cta, onClick, image, imagePosition, Icon } = slide;

  return (
    <div className="relative h-full w-full shrink-0 overflow-hidden">
      {/* Right-hand visual */}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          className="absolute inset-y-0 right-0 h-full w-[68%] object-cover"
          style={{ objectPosition: imagePosition ?? '50% 20%' }}
        />
      ) : (
        <div className="absolute inset-y-0 right-0 flex w-[60%] items-center justify-center">
          <span className="absolute h-[70cqw] w-[70cqw] rounded-full bg-orange-500/20 blur-3xl" />
          {Icon && (
            <span className="relative flex h-[30cqw] w-[30cqw] items-center justify-center rounded-[8cqw] border border-orange-400/50 bg-orange-500/10 shadow-[0_0_6cqw_rgba(251,146,60,0.35),inset_0_0_4cqw_rgba(251,146,60,0.12)]">
              <Icon className="h-[15cqw] w-[15cqw] text-orange-400" strokeWidth={1.4} />
            </span>
          )}
        </div>
      )}

      {/* Warm bokeh + left-to-right fade so the text always reads */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_20%,rgba(251,146,60,0.25),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0806] from-[34%] via-[#0b0806]/80 via-[48%] to-transparent to-[78%]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/55 to-transparent" />

      {/* Copy + CTA */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-10 flex flex-col justify-center px-[4.8cqw] pb-[4cqw] text-left active:scale-[0.995]"
      >
        <span className="block font-display text-[5.8cqw] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
          {title}
        </span>
        <span className="block bg-gradient-to-r from-amber-300 via-orange-400 to-orange-500 bg-clip-text pr-[1cqw] font-display text-[5.8cqw] font-extrabold italic leading-[1.15] tracking-[-0.02em] text-transparent">
          {highlight}
        </span>
        <span className="mt-[1.6cqw] block max-w-[52%] truncate text-[2.7cqw] font-medium text-white/90">
          {subtitle}
        </span>
        <span className="mt-[3.2cqw] inline-flex h-[8.8cqw] w-fit items-center gap-[1.6cqw] rounded-full bg-gradient-to-b from-amber-400 to-orange-500 px-[5cqw] text-[3.1cqw] font-extrabold text-black shadow-[0_0_5cqw_rgba(251,146,60,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]">
          {cta}
          <ArrowRight className="h-[3.4cqw] w-[3.4cqw]" strokeWidth={2.6} />
        </span>
      </button>
    </div>
  );
}