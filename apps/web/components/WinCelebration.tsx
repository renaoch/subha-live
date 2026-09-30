"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";

interface WinCelebrationProps {
  /** Change this to retrigger the burst (e.g. the settled round id). */
  triggerKey: string | number;
  /** Bigger burst for jackpot ("lucky") wins. */
  big?: boolean;
}

const COIN_EMOJI = "🪙";
const STAR_EMOJI = "✨";

export function WinCelebration({ triggerKey, big = false }: WinCelebrationProps) {
  const particles = useMemo(() => {
    const count = big ? 28 : 14;
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const distance = (big ? 140 : 90) + Math.random() * 60;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 30;
      const delay = Math.random() * 0.15;
      const isStar = i % 5 === 0;
      return { id: i, tx, ty, delay, isStar };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey, big]);

  return (
    <div
      key={triggerKey}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-gift-particle text-2xl"
          style={
            {
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        >
          {p.isStar ? STAR_EMOJI : COIN_EMOJI}
        </span>
      ))}
    </div>
  );
}