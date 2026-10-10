"use client";

import type { CSSProperties } from "react";
import { Gift } from "lucide-react";
import { GiftImage } from "@/components/GiftImage";
import { LevelGem } from "@/components/room/hud/LevelGem";
import { UserTags } from "@/components/room/hud/UserTags";
import { getGiftIntensity, getGiftTheme } from "@/lib/gift-theme";

/**
 * "X Sent Rocket x66" row.
 *
 * - Same compact two-line pill as the "joined" row (212px wide), so the chat
 *   column reads as one consistent stack. The gift art sits OUTSIDE the pill on
 *   the right, so it can never cover the name or badges.
 * - Every kind of gift moves differently (see lib/gift-theme.ts): rockets
 *   launch, roses bloom, teddies bounce, perfume sways, crowns shine…
 * - The glow colour follows the gift; bigger sends (x10, x50, expensive) glow
 *   harder and shed more.
 * - Every combo tick re-pops the amount and re-bursts the art.
 */
export function GiftRow({
  username,
  avatar,
  level,
  tags,
  gift,
  onOpenProfile,
}: {
  username: string;
  avatar: string | null;
  level?: number;
  tags?: string[];
  gift: { name: string; icon: string | null; code?: string; quantity: number; coinPrice?: number } | undefined;
  onOpenProfile?: () => void;
}) {
  const qty = gift?.quantity ?? 1;
  const theme = getGiftTheme({ code: gift?.code, icon: gift?.icon, name: gift?.name }, gift?.coinPrice);
  const intensity = getGiftIntensity(qty, gift?.coinPrice);
  const art = gift ? { code: gift.code, icon: gift.icon ?? undefined } : null;

  return (
    <div
      className={`gift-row gift-${intensity} gm-${theme.motion} relative`}
      style={{ "--glow": theme.glow } as CSSProperties}
    >
      <div className="gift-pill relative flex w-[212px] items-center gap-2 rounded-full py-1 pl-1 pr-4">
        <span className="gift-sweep pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden>
          <span className="gift-sweep-bar absolute inset-y-0 -left-1/3 w-1/3" />
        </span>

        <button type="button" onClick={onOpenProfile} className="relative z-10 shrink-0">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote user avatar
            <img src={avatar} alt={username} className="gift-avatar h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="gift-avatar flex h-8 w-8 items-center justify-center rounded-full bg-[#3a1a2c] text-[12px] font-bold text-white">
              {username.trim().slice(0, 1).toUpperCase() || "?"}
            </span>
          )}
        </button>

        <div className="relative z-10 min-w-0 flex-1">
          {/* Badges fade out at the edge instead of running under the art. */}
          <div className="gift-badges flex items-center gap-1 overflow-hidden">
            <span className="min-w-0 max-w-[64px] shrink truncate text-[13px] font-bold leading-[1.15] text-white">{username}</span>
            {level ? <LevelGem level={level} className="px-1 py-px text-[9.5px] [&>svg]:h-[9px] [&>svg]:w-[9px]" /> : null}
            <UserTags tags={tags} className="px-1 py-px text-[9px]" />
          </div>
          <p className="flex items-center gap-1.5 leading-[1.15]">
            <span className="min-w-0 truncate text-[11.5px] font-semibold text-[#ffd27a]">Sent {gift?.name ?? "a gift"}</span>
            {qty > 1 && (
              <span key={qty} className="gift-amount text-[15px] font-black italic tracking-tight">
                x{qty}
              </span>
            )}
          </p>
        </div>

        {art && (
          <span className="gift-art pointer-events-none absolute -right-[56px] top-1/2 z-20 flex h-[68px] w-[68px] -translate-y-1/2 items-center justify-center">
            <span key={`burst-${qty}`} className="gift-burst absolute inset-2 rounded-full" aria-hidden />
            <span className="gift-motion flex h-full w-full items-center justify-center">
              <GiftImage
                gift={art}
                fallbackIcon={Gift}
                className="gift-img-glow flex h-full w-full items-center justify-center"
                imgClassName="h-[62px] w-[62px] object-contain"
              />
            </span>
            {theme.sparks.map((s, i) => (
              <span key={`${qty}-${i}`} className={`gift-spark gift-spark-${i} absolute left-1/2 top-1/2 text-[11px]`} aria-hidden>
                {s}
              </span>
            ))}
          </span>
        )}
      </div>

      <style jsx>{`
        .gift-row {
          animation: gift-in 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-origin: left center;
          --glow-a: 0.5;
          --glow-size: 1;
        }
        .gift-hot { --glow-a: 0.7; --glow-size: 1.25; }
        .gift-mega { --glow-a: 0.9; --glow-size: 1.6; }

        .gift-pill {
          background: linear-gradient(90deg, rgba(var(--glow), 0.42), rgba(18, 6, 14, 0.66) 72%);
          box-shadow: inset 0 0 0 1.5px rgba(var(--glow), 0.95), 0 0 calc(16px * var(--glow-size)) rgba(var(--glow), var(--glow-a));
          animation: gift-glow 1.4s ease-in-out infinite;
        }
        .gift-avatar { box-shadow: 0 0 0 2px rgba(var(--glow), 0.95); }
        .gift-badges {
          -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 14px), transparent);
          mask-image: linear-gradient(to right, #000 calc(100% - 14px), transparent);
        }

        .gift-sweep-bar {
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.5), transparent);
          transform: skewX(-20deg);
          animation: gift-sweep 2.2s ease-in-out 0.5s infinite;
        }

        /* Amount: pops on every combo tick, then keeps breathing a deep glow. */
        .gift-amount {
          display: inline-block;
          flex-shrink: 0;
          color: #fff;
          animation:
            gift-count-pop 0.5s cubic-bezier(0.34, 1.8, 0.64, 1) both,
            gift-amount-glow 1.5s ease-in-out 0.5s infinite;
        }
        /* Gift art: same breathing glow, in the gift's colour. */
        :global(.gift-img-glow) {
          animation: gift-img-glow 1.5s ease-in-out infinite;
        }
        .gift-art { animation: gift-art-in 0.7s 0.1s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .gift-burst {
          background: radial-gradient(circle, rgba(var(--glow), 0.9), rgba(var(--glow), 0) 70%);
          animation: gift-burst 0.7s ease-out both;
        }
        .gift-spark { opacity: 0; animation: gift-spark 1s ease-out both; }
        .gift-spark-0 { --dx: -34px; --dy: -30px; }
        .gift-spark-1 { --dx: 10px;  --dy: -40px; animation-delay: 0.06s; }
        .gift-spark-2 { --dx: 38px;  --dy: -18px; animation-delay: 0.03s; }
        .gift-spark-3 { --dx: -26px; --dy: 30px;  animation-delay: 0.1s; }
        .gift-spark-4 { --dx: 32px;  --dy: 28px;  animation-delay: 0.08s; }
        .gift-hot .gift-spark, .gift-mega .gift-spark { font-size: 14px; }
        .gift-mega .gift-spark { animation-duration: 1.3s; }

        /* ── One motion per kind of gift ─────────────────────────────── */
        .gm-float  .gift-motion { animation: gm-float 2s ease-in-out infinite; }
        .gm-launch .gift-motion { animation: gm-launch 1.6s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
        .gm-bloom  .gift-motion { animation: gm-bloom 2.2s ease-in-out infinite; }
        .gm-bounce .gift-motion { animation: gm-bounce 1.1s cubic-bezier(0.28, 0.84, 0.42, 1) infinite; }
        .gm-sway   .gift-motion { animation: gm-sway 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
        .gm-spin   .gift-motion { animation: gm-spin 2.6s ease-in-out infinite; }
        .gm-royal  .gift-motion { animation: gm-royal 1.8s ease-in-out infinite; }
        .gm-drive  .gift-motion { animation: gm-drive 1.4s ease-in-out infinite; }

        @keyframes gm-float  { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-6px) rotate(3deg) scale(1.05); } }
        @keyframes gm-launch {
          0%   { transform: translateY(10px) scale(0.92) rotate(-6deg); }
          35%  { transform: translateY(-12px) scale(1.12) rotate(2deg); }
          55%  { transform: translateY(-6px) scale(1.04) rotate(-2deg); }
          100% { transform: translateY(10px) scale(0.92) rotate(-6deg); }
        }
        @keyframes gm-bloom  { 0%,100% { transform: scale(0.94) rotate(-8deg); } 50% { transform: scale(1.16) rotate(8deg); } }
        @keyframes gm-bounce {
          0%,100% { transform: translateY(0) scale(1.08, 0.9); }
          45%     { transform: translateY(-11px) scale(0.95, 1.08); }
          70%     { transform: translateY(0) scale(1.05, 0.95); }
        }
        @keyframes gm-sway   { 0%,100% { transform: rotate(-11deg); } 50% { transform: rotate(11deg) translateY(-3px); } }
        @keyframes gm-spin   { 0% { transform: rotateY(0) scale(1); } 50% { transform: rotateY(180deg) scale(1.1); } 100% { transform: rotateY(360deg) scale(1); } }
        @keyframes gm-royal  { 0%,100% { transform: translateY(0) scale(1); filter: brightness(1); } 50% { transform: translateY(-5px) scale(1.12); filter: brightness(1.25); } }
        @keyframes gm-drive  { 0%,100% { transform: translateX(-5px) skewX(0); } 50% { transform: translateX(6px) skewX(-6deg); } }

        @keyframes gift-in {
          0%   { opacity: 0; transform: translateX(-90px) scale(0.8); }
          55%  { opacity: 1; transform: translateX(8px) scale(1.05); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes gift-glow {
          0%, 100% { box-shadow: inset 0 0 0 1.5px rgba(var(--glow), 0.95), 0 0 calc(14px * var(--glow-size)) rgba(var(--glow), calc(var(--glow-a) * 0.7)); }
          50%      { box-shadow: inset 0 0 0 2px rgba(var(--glow), 1), 0 0 calc(28px * var(--glow-size)) rgba(var(--glow), var(--glow-a)), 0 0 calc(46px * var(--glow-size)) rgba(var(--glow), 0.25); }
        }
        @keyframes gift-amount-glow {
          0%, 100% { text-shadow: 0 0 4px rgba(var(--glow), 0.9), 0 0 10px rgba(var(--glow), 0.6); }
          50%      { text-shadow: 0 0 8px rgba(var(--glow), 1), 0 0 18px rgba(var(--glow), 0.95), 0 0 34px rgba(var(--glow), 0.7), 0 0 52px rgba(var(--glow), 0.4); }
        }
        @keyframes gift-img-glow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(var(--glow), 0.85)) drop-shadow(0 0 12px rgba(var(--glow), 0.5)); }
          50%      { filter: drop-shadow(0 0 9px rgba(var(--glow), 1)) drop-shadow(0 0 20px rgba(var(--glow), 0.9)) drop-shadow(0 0 34px rgba(var(--glow), 0.55)); }
        }
        @keyframes gift-sweep {
          0%   { left: -40%; opacity: 0; }
          15%  { opacity: 1; }
          55%, 100% { left: 120%; opacity: 0; }
        }
        @keyframes gift-count-pop {
          0%   { transform: scale(2.4) rotate(-8deg); opacity: 0; color: #ffe08a; }
          60%  { transform: scale(0.92); opacity: 1; }
          100% { transform: scale(1) rotate(0); color: #fff; }
        }
        @keyframes gift-art-in {
          0%   { opacity: 0; transform: translateY(-50%) scale(0.2) rotate(-30deg); }
          100% { opacity: 1; transform: translateY(-50%) scale(1) rotate(0); }
        }
        @keyframes gift-burst {
          0%   { opacity: 0.95; transform: scale(0.4); }
          100% { opacity: 0;    transform: scale(2.2); }
        }
        @keyframes gift-spark {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2) rotate(40deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gift-row, .gift-pill, .gift-sweep-bar, .gift-amount, :global(.gift-img-glow), .gift-motion, .gift-art, .gift-burst, .gift-spark { animation: none; }
          .gift-spark { display: none; }
        }
      `}</style>
    </div>
  );
}