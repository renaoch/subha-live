"use client";

import { Gift } from "lucide-react";
import { GiftImage } from "@/components/GiftImage";
import { LevelGem } from "@/components/room/hud/LevelGem";
import { UserTags } from "@/components/room/hud/UserTags";

const SPARKS = ["✨", "💖", "⭐", "✨", "💫"];

/**
 * "X Sent Rose x10" row. Springs in, the border pulses, a light sweep crosses
 * the pill, the big gift art bobs and sheds sparkles, and every combo tick
 * (quantity change) re-triggers a pop + burst. Bigger combos get a hotter
 * glow. The pill is clipped separately from the art so the art can overhang.
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
  gift: { name: string; icon: string | null; code?: string; quantity: number } | undefined;
  onOpenProfile?: () => void;
}) {
  const qty = gift?.quantity ?? 1;
  const tier = qty >= 50 ? "mega" : qty >= 10 ? "hot" : "base";
  const art = gift ? { code: gift.code, icon: gift.icon ?? undefined } : null;

  return (
    <div className={`gift-row gift-${tier} relative`}>
      <div className="gift-pill relative flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3">
        <span className="gift-sweep pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden>
          <span className="gift-sweep-bar absolute inset-y-0 -left-1/3 w-1/3" />
        </span>

        <button type="button" onClick={onOpenProfile} className="relative z-10 shrink-0">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote user avatar
            <img src={avatar} alt={username} className="h-9 w-9 rounded-full object-cover ring-2 ring-[#ff7aa8]" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5a1a38] text-[13px] font-bold text-white ring-2 ring-[#ff7aa8]">
              {username.trim().slice(0, 1).toUpperCase() || "?"}
            </span>
          )}
        </button>

        <span className="relative z-10 flex items-center gap-1.5 text-[15px] font-semibold text-white">
          <span className="max-w-[88px] truncate">{username}</span>
          {level ? <LevelGem level={level} /> : null}
          <UserTags tags={tags} />
          <span className="whitespace-nowrap text-[#ffd27a]">Sent {gift?.name ?? "a gift"}</span>
          {art && (
            <GiftImage
              gift={art}
              fallbackIcon={Gift}
              className="flex h-6 w-6 shrink-0 items-center justify-center"
              imgClassName="h-6 w-6 object-contain"
            />
          )}
          {qty > 1 && (
            <span key={qty} className="gift-count font-extrabold text-white">
              x{qty}
            </span>
          )}
        </span>

        {art && (
          <span className="gift-art pointer-events-none absolute -right-[64px] -top-7 z-20 flex h-[88px] w-[88px] items-center justify-center">
            <span key={`burst-${qty}`} className="gift-burst absolute inset-3 rounded-full" aria-hidden />
            <span className="gift-float flex h-full w-full items-center justify-center">
              <GiftImage
                gift={art}
                fallbackIcon={Gift}
                className="flex h-full w-full items-center justify-center"
                imgClassName="h-[88px] w-[88px] object-contain drop-shadow-[0_6px_16px_rgba(255,50,120,0.7)]"
              />
            </span>
            {SPARKS.map((s, i) => (
              <span key={`${qty}-${i}`} className={`gift-spark gift-spark-${i} absolute left-1/2 top-1/2 text-[13px]`} aria-hidden>
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
          --glow: 255, 50, 120;
          --glow-a: 0.55;
        }
        .gift-hot { --glow: 255, 140, 40; --glow-a: 0.7; }
        .gift-mega { --glow: 190, 90, 255; --glow-a: 0.85; }

        .gift-pill {
          background: linear-gradient(90deg, rgba(255, 40, 110, 0.5), rgba(120, 10, 60, 0.6) 70%, rgba(20, 6, 16, 0.65));
          box-shadow: inset 0 0 0 1.5px rgba(var(--glow), 0.95), 0 0 16px rgba(var(--glow), var(--glow-a));
          animation: gift-glow 1.4s ease-in-out infinite;
        }
        .gift-hot .gift-pill { background: linear-gradient(90deg, rgba(255, 140, 30, 0.55), rgba(110, 40, 6, 0.62) 70%, rgba(20, 10, 4, 0.66)); }
        .gift-mega .gift-pill { background: linear-gradient(90deg, rgba(170, 70, 255, 0.55), rgba(60, 14, 110, 0.62) 70%, rgba(14, 6, 24, 0.66)); }

        .gift-sweep-bar {
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.5), transparent);
          transform: skewX(-20deg);
          animation: gift-sweep 2.2s ease-in-out 0.5s infinite;
        }
        .gift-count { display: inline-block; animation: gift-count-pop 0.5s cubic-bezier(0.34, 1.8, 0.64, 1) both; }
        .gift-float { animation: gift-float 2s ease-in-out infinite; }
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

        @keyframes gift-in {
          0%   { opacity: 0; transform: translateX(-90px) scale(0.8); }
          55%  { opacity: 1; transform: translateX(8px) scale(1.05); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes gift-glow {
          0%, 100% { box-shadow: inset 0 0 0 1.5px rgba(var(--glow), 0.95), 0 0 14px rgba(var(--glow), calc(var(--glow-a) * 0.7)); }
          50%      { box-shadow: inset 0 0 0 2px rgba(var(--glow), 1), 0 0 28px rgba(var(--glow), var(--glow-a)), 0 0 46px rgba(var(--glow), 0.25); }
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
        @keyframes gift-float {
          0%, 100% { transform: translateY(0) rotate(-3deg) scale(1); }
          50%      { transform: translateY(-6px) rotate(3deg) scale(1.06); }
        }
        @keyframes gift-art-in {
          0%   { opacity: 0; transform: scale(0.2) rotate(-30deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
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
          .gift-row, .gift-pill, .gift-sweep-bar, .gift-count, .gift-float, .gift-art, .gift-burst, .gift-spark { animation: none; }
          .gift-spark { display: none; }
        }
      `}</style>
    </div>
  );
}
