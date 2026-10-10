// components/GiftSendAnimation.tsx
"use client";

import { useEffect, type CSSProperties } from "react";
import { Gift as GiftIcon } from "lucide-react";
import { GiftImage } from "@/components/GiftImage";
import { playGiftSentSound } from "@/lib/sound";
import { getGiftIntensity, getGiftTheme, type GiftMotion } from "@/lib/gift-theme";

export interface SentGift {
  code?: string;
  icon?: string;
  name: string;
  /** 0-based catalog position — maps to gift-N.png in the bucket. */
  position?: number;
  /** How many were sent in this go (shown as "x66"). Defaults to 1. */
  quantity?: number;
  /** Coin price of one gift — used to pick the animation tier. */
  coinPrice?: number;
  /** Changes on every send so back-to-back sends restart the animation. */
  nonce?: number;
}

interface GiftSendAnimationProps {
  gift: SentGift;
  onDone: () => void;
}

/** Bigger sends get to stay on screen a little longer. */
const VISIBLE_MS = { base: 1900, hot: 2300, mega: 2900 } as const;

// How the art arrives, per kind of gift. Each maps to a keyframe below.
const ENTRANCE: Record<GiftMotion, string> = {
  float: "gsa-rise",
  launch: "gsa-launch",
  bloom: "gsa-bloom",
  bounce: "gsa-drop",
  sway: "gsa-swing",
  spin: "gsa-spin",
  royal: "gsa-royal",
  drive: "gsa-drive",
};

/**
 * Full-screen "gift sent" celebration. Every KIND of gift arrives its own way
 * (rockets launch up, roses bloom open, teddies drop and bounce, perfume
 * swings in, crowns flash in…), in that gift's colour, shedding its own
 * emojis. Multi-sends show a big "x66" and run bigger and longer. Fully
 * non-interactive and self-dismissing.
 */
export function GiftSendAnimation({ gift, onDone }: GiftSendAnimationProps) {
  const qty = Math.max(1, gift.quantity ?? 1);
  const theme = getGiftTheme(gift, gift.coinPrice);
  const intensity = getGiftIntensity(qty, gift.coinPrice);
  const count = intensity === "mega" ? 18 : intensity === "hot" ? 14 : 10;
  const radius = intensity === "mega" ? 140 : intensity === "hot" ? 115 : 90;
  const art = intensity === "mega" ? 112 : intensity === "hot" ? 96 : 80;

  useEffect(() => {
    playGiftSentSound();
    const timer = setTimeout(onDone, VISIBLE_MS[intensity]);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const particles = Array.from({ length: count });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center"
      style={{ "--glow": theme.glow, "--art": art } as CSSProperties}
    >
      {/* Soft colour wash so a big send feels bigger than the video behind it */}
      {intensity !== "base" && (
        <div
          className="gsa-wash absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(var(--glow), 0.28), transparent 62%)" }}
        />
      )}

      <div className="relative flex flex-col items-center">
        {/* Spinning rays in the gift's colour */}
        <div
          className="animate-gift-ray-spin absolute rounded-full"
          style={{
            width: art * 2,
            height: art * 2,
            background:
              "conic-gradient(from 0deg, rgba(var(--glow), 0.6), transparent 20%, transparent 50%, rgba(var(--glow), 0.6) 70%, transparent 90%)",
            filter: "blur(2px)",
          }}
        />

        {/* Emoji sparks bursting outward */}
        {particles.map((_, i) => {
          const angle = (i / particles.length) * 2 * Math.PI;
          const tx = Math.cos(angle) * radius;
          const ty = Math.sin(angle) * radius;
          return (
            <span
              key={i}
              className="absolute text-[16px]"
              style={
                {
                  "--tx": `${tx}px`,
                  "--ty": `${ty}px`,
                  animation: `gift-particle ${intensity === "mega" ? 1.3 : 0.9}s ease-out 0.25s both`,
                } as CSSProperties
              }
            >
              {theme.sparks[i % theme.sparks.length]}
            </span>
          );
        })}

        {/* The gift art: arrives its own way, then pulses with a glow */}
        <div className={`gsa-enter ${ENTRANCE[theme.motion]}`}>
          <div className="gsa-pulse">
            <GiftImage
              gift={gift}
              position={gift.position}
              fallbackIcon={GiftIcon}
              className="gsa-glow flex items-center justify-center rounded-full"
              imgClassName="object-contain text-amber-300"
            />
          </div>
        </div>

        {qty > 1 && (
          <p key={qty} className="gsa-qty mt-2 text-[44px] font-black italic leading-none text-white">
            x{qty}
          </p>
        )}

        <p className="animate-pop-in mt-3 rounded-full border border-white/15 bg-black/50 px-4 py-1.5 text-[13px] font-semibold text-white shadow-glow backdrop-blur">
          Sent {gift.name}
          {qty > 1 ? ` x${qty}` : "!"} 🎉
        </p>
      </div>

      <style jsx>{`
        .gsa-enter :global(.gsa-glow) {
          width: calc(var(--art) * 1px + 20px);
          height: calc(var(--art) * 1px + 20px);
          animation: gsa-glow 0.9s ease-in-out 0.5s infinite;
        }
        .gsa-enter :global(.gsa-glow img),
        .gsa-enter :global(.gsa-glow svg) {
          width: calc(var(--art) * 1px);
          height: calc(var(--art) * 1px);
        }
        .gsa-pulse { animation: gift-hold-pulse 0.7s ease-in-out 0.6s 3; }
        .gsa-wash { animation: gsa-wash 1.2s ease-out both; }
        .gsa-qty {
          animation: gsa-qty 0.55s cubic-bezier(0.34, 1.8, 0.64, 1) both, gsa-qty-glow 0.9s ease-in-out 0.55s infinite;
        }

        .gsa-rise   { animation: gsa-rise 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .gsa-launch { animation: gsa-launch 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
        .gsa-bloom  { animation: gsa-bloom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .gsa-drop   { animation: gsa-drop 0.9s cubic-bezier(0.28, 0.84, 0.42, 1) both; }
        .gsa-swing  { animation: gsa-swing 0.9s ease-out both; transform-origin: 50% 0; }
        .gsa-spin   { animation: gsa-spin 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .gsa-royal  { animation: gsa-royal 0.8s cubic-bezier(0.2, 1.2, 0.3, 1) both; }
        .gsa-drive  { animation: gsa-drive 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both; }

        @keyframes gsa-rise   { 0% { transform: translateY(90px) scale(0.4); opacity: 0; } 100% { transform: none; opacity: 1; } }
        @keyframes gsa-launch {
          0%   { transform: translateY(320px) scale(0.5) rotate(-4deg); opacity: 0; }
          25%  { opacity: 1; }
          70%  { transform: translateY(-34px) scale(1.15) rotate(2deg); }
          100% { transform: none; }
        }
        @keyframes gsa-bloom  { 0% { transform: scale(0) rotate(-120deg); opacity: 0; } 70% { transform: scale(1.2) rotate(8deg); opacity: 1; } 100% { transform: none; } }
        @keyframes gsa-drop {
          0%   { transform: translateY(-260px) scale(0.9, 1.1); opacity: 0; }
          40%  { transform: translateY(0) scale(1.2, 0.8); opacity: 1; }
          60%  { transform: translateY(-46px) scale(0.92, 1.08); }
          78%  { transform: translateY(0) scale(1.08, 0.94); }
          100% { transform: none; }
        }
        @keyframes gsa-swing  { 0% { transform: rotate(-70deg) translateY(-60px); opacity: 0; } 40% { transform: rotate(25deg); opacity: 1; } 70% { transform: rotate(-12deg); } 100% { transform: none; } }
        @keyframes gsa-spin   { 0% { transform: rotateY(-540deg) scale(0.3); opacity: 0; } 100% { transform: none; opacity: 1; } }
        @keyframes gsa-royal  { 0% { transform: scale(2.6); opacity: 0; filter: brightness(2.5); } 60% { transform: scale(0.92); opacity: 1; filter: brightness(1.6); } 100% { transform: none; filter: none; } }
        @keyframes gsa-drive  { 0% { transform: translateX(-340px) skewX(-18deg); opacity: 0; } 70% { transform: translateX(14px) skewX(4deg); opacity: 1; } 100% { transform: none; } }

        @keyframes gsa-glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(var(--glow), 0.8)) drop-shadow(0 0 24px rgba(var(--glow), 0.5)); }
          50%      { filter: drop-shadow(0 0 18px rgba(var(--glow), 1)) drop-shadow(0 0 40px rgba(var(--glow), 0.9)) drop-shadow(0 0 64px rgba(var(--glow), 0.5)); }
        }
        @keyframes gsa-wash { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0.6; } }
        @keyframes gsa-qty { 0% { transform: scale(3) rotate(-10deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes gsa-qty-glow {
          0%, 100% { text-shadow: 0 0 8px rgba(var(--glow), 0.9), 0 0 20px rgba(var(--glow), 0.6); }
          50%      { text-shadow: 0 0 14px rgba(var(--glow), 1), 0 0 34px rgba(var(--glow), 0.95), 0 0 60px rgba(var(--glow), 0.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gsa-enter, .gsa-pulse, .gsa-wash, .gsa-qty, .gsa-enter :global(.gsa-glow) { animation: none; }
        }
      `}</style>
    </div>
  );
}