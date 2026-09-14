// components/GiftSendAnimation.tsx
"use client";

import { useEffect } from "react";
import { Gift as GiftIcon } from "lucide-react";
import { GiftImage } from "@/components/GiftImage";
import { playGiftSentSound } from "@/lib/sound";

export interface SentGift {
  code?: string;
  icon?: string;
  name: string;
}

interface GiftSendAnimationProps {
  gift: SentGift;
  onDone: () => void;
}

const VISIBLE_MS = 1900;

/**
 * Full-screen "gift sent" celebration: the gift art flies in, holds with
 * a pulse and a burst of sparks, plays a short chime, then flies out.
 * Fully non-interactive (pointer-events none) so it never blocks the UI
 * underneath, and self-dismisses via `onDone` after VISIBLE_MS.
 */
export function GiftSendAnimation({ gift, onDone }: GiftSendAnimationProps) {
  useEffect(() => {
    playGiftSentSound();
    const timer = setTimeout(onDone, VISIBLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const particles = Array.from({ length: 10 });

  return (
    <div className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        {/* Spinning glow rays behind the gift */}
        <div
          className="animate-gift-ray-spin absolute h-40 w-40 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(var(--accent-gold) / 0.55), transparent 20%, transparent 80%, hsl(var(--accent-gold) / 0.55))",
            filter: "blur(2px)",
          }}
        />

        {/* Sparkle particles bursting outward */}
        {particles.map((_, i) => {
          const angle = (i / particles.length) * 2 * Math.PI;
          const tx = Math.cos(angle) * 90;
          const ty = Math.sin(angle) * 90;
          return (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-300"
              style={
                {
                  "--tx": `${tx}px`,
                  "--ty": `${ty}px`,
                  animation: "gift-particle 0.9s ease-out 0.25s both",
                } as React.CSSProperties
              }
            />
          );
        })}

        {/* The gift art itself: fly in, pulse, then fly out */}
        <div className="animate-gift-fly-in">
          <div className="animate-gift-hold-pulse">
            <GiftImage
              gift={gift}
              fallbackIcon={GiftIcon}
              className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-glow-lg backdrop-blur"
              imgClassName="h-16 w-16 object-contain text-amber-300"
            />
          </div>
        </div>

        <p className="animate-pop-in mt-3 rounded-full border border-white/15 bg-black/50 px-4 py-1.5 text-[13px] font-semibold text-white shadow-glow backdrop-blur">
          Sent {gift.name}! 🎉
        </p>
      </div>
    </div>
  );
}
