"use client";

import { LevelGem } from "@/components/room/hud/LevelGem";
import { UserTags } from "@/components/room/hud/UserTags";

const PARTICLES = ["✨", "🎉", "💫", "🎊"];

/**
 * "X joined" row. Springs in from the left, the avatar pops with a one-shot
 * ring pulse, confetti bursts off the avatar and the wave keeps waving.
 * Level and tags are flat chips — all the motion lives in the row itself.
 */
export function JoinRow({
  name,
  avatar,
  level,
  tags,
  onOpenProfile,
}: {
  name: string;
  avatar: string | null;
  level?: number;
  tags?: string[];
  onOpenProfile?: () => void;
}) {
  return (
    <div className="join-row relative flex min-w-[210px] items-center gap-2 rounded-full py-1 pl-1 pr-3.5 backdrop-blur-md">
      <button type="button" onClick={onOpenProfile} className="join-avatar relative shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote user avatar
          <img src={avatar} alt={name} className="relative z-10 h-8 w-8 rounded-full object-cover ring-2 ring-[#ffd27a]" />
        ) : (
          <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#3b2a55] text-[12px] font-bold text-white ring-2 ring-[#ffd27a]">
            {name.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
        )}
        <span className="join-ring absolute inset-0 rounded-full ring-2 ring-[#ffd27a]" aria-hidden />
        {PARTICLES.map((p, i) => (
          <span key={i} className={`join-particle join-particle-${i} absolute left-1/2 top-1/2 text-[12px]`} aria-hidden>
            {p}
          </span>
        ))}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13px] font-bold leading-[1.15] text-white">{name}</span>
          {level ? <LevelGem level={level} className="px-1 py-px text-[9.5px] [&>svg]:h-[9px] [&>svg]:w-[9px]" /> : null}
          <UserTags tags={tags} className="px-1 py-px text-[9px]" />
        </div>
        <p className="flex items-center gap-1 text-[11.5px] font-semibold leading-[1.15] text-[#ffd27a]">
          Joined the room <span className="join-wave inline-block origin-[70%_70%]">👋</span>
        </p>
      </div>

      <style jsx>{`
        .join-row {
          background: linear-gradient(90deg, rgba(255, 170, 60, 0.28), rgba(0, 0, 0, 0.6) 70%);
          box-shadow: inset 0 0 0 1px rgba(255, 210, 122, 0.35);
          animation: join-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-origin: left center;
        }
        .join-avatar {
          animation: join-avatar-pop 0.6s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .join-ring {
          animation: join-ring 1s 0.35s ease-out 2 both;
          pointer-events: none;
        }
        .join-wave {
          animation: join-wave 1.1s 0.5s ease-in-out 3;
        }
        .join-particle {
          opacity: 0;
          pointer-events: none;
          animation: join-burst 0.9s 0.3s ease-out both;
        }
        .join-particle-0 { --dx: -26px; --dy: -22px; }
        .join-particle-1 { --dx: 6px;   --dy: -30px; animation-delay: 0.38s; }
        .join-particle-2 { --dx: 30px;  --dy: -14px; animation-delay: 0.34s; }
        .join-particle-3 { --dx: -14px; --dy: 24px;  animation-delay: 0.42s; }

        @keyframes join-in {
          0%   { opacity: 0; transform: translateX(-70px) scale(0.85); }
          60%  { opacity: 1; transform: translateX(6px) scale(1.04); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes join-avatar-pop {
          0%   { transform: scale(0) rotate(-25deg); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes join-ring {
          0%   { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.9); }
        }
        @keyframes join-wave {
          0%, 100% { transform: rotate(0); }
          20% { transform: rotate(22deg); }
          40% { transform: rotate(-14deg); }
          60% { transform: rotate(22deg); }
          80% { transform: rotate(-8deg); }
        }
        @keyframes join-burst {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15) rotate(30deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .join-row, .join-avatar, .join-ring, .join-wave, .join-particle { animation: none; }
          .join-particle { display: none; }
        }
      `}</style>
    </div>
  );
}