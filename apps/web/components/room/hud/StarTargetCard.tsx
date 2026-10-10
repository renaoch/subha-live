"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Star, X } from "lucide-react";
import type { RoomTask } from "@/lib/api/room-tasks";

/** Glossy gold star (vector, no data). */
function GoldStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="stc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a8" />
          <stop offset="0.55" stopColor="#ffc72e" />
          <stop offset="1" stopColor="#e08a0a" />
        </linearGradient>
      </defs>
      <path
        d="M24 3.5 L30.2 16.8 L44.6 18.6 L34 28.6 L36.8 43 L24 36 L11.2 43 L14 28.6 L3.4 18.6 L17.8 16.8 Z"
        fill="url(#stc-gold)"
        stroke="#ffe9a0"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M24 9 L28 18 L24 20 L20 18 Z" fill="#fff8d0" opacity="0.65" />
    </svg>
  );
}

interface StarTargetCardProps {
  task: RoomTask | null;
  claiming: boolean;
  onClaim: () => Promise<unknown>;
}

/**
 * "Star Target 12650/20000" — the room's live gift goal. Progress comes from
 * the server: every gift sent in the room adds its coin value to the active
 * goal in one atomic SQL update (see bump_room_task).
 *
 * Star Targets are set ONLY from the admin console (Admin → Star targets).
 * Nobody — host, agency owner, viewer, or even an admin — can create, edit or
 * end one from inside a room; there is deliberately no "Set Star Target"
 * button here. This card just shows progress and, once the goal is reached,
 * lets each person claim their reward.
 */
export function StarTargetCard({ task, claiming, onClaim }: StarTargetCardProps) {
  const [open, setOpen] = useState(false);
  const live = task && (task.status === "active" || task.status === "completed") ? task : null;

  if (!live) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Star Target ${live.currentValue} of ${live.targetValue}`}
        className="star-card relative flex h-[80px] w-full flex-col justify-center gap-2 rounded-[20px] px-3 text-left backdrop-blur-xl transition active:scale-[0.97]"
      >
        <span className="flex items-center gap-2.5">
          <GoldStar className="h-[40px] w-[40px] shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold leading-tight text-white">Star Target</span>
            <span
              className={`block truncate font-bold leading-tight tabular-nums text-white ${
                `${live.currentValue}/${live.targetValue}`.length > 11 ? "text-[13px]" : "text-[16px]"
              }`}
            >
              {live.currentValue}/{live.targetValue}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/85" />
        </span>
        <span className="block h-[7px] w-full overflow-hidden rounded-full bg-white/12">
          <span
            className="block h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.min(100, Math.max(live.progress, 4))}%`,
              background: "linear-gradient(90deg,#ff3d8b,#ff9a3d 55%,#ffe36a)",
              boxShadow: "0 0 8px rgba(255,170,60,0.65)",
            }}
          />
        </span>
        <style jsx>{`
          .star-card {
            border: 1.5px solid transparent;
            background:
              linear-gradient(rgba(16, 11, 6, 0.8), rgba(16, 11, 6, 0.8)) padding-box,
              linear-gradient(135deg, #ffe9a0, #f5b93f 38%, rgba(255, 255, 255, 0.4) 70%, #f5b93f) border-box;
            box-shadow: 0 0 18px rgba(245, 185, 63, 0.3), inset 0 0 24px rgba(245, 185, 63, 0.08);
          }
        `}</style>
      </button>

      {open && <StarTargetSheet task={live} claiming={claiming} onClose={() => setOpen(false)} onClaim={onClaim} />}
    </>
  );
}

function StarTargetSheet({
  task,
  claiming,
  onClose,
  onClaim,
}: {
  task: RoomTask;
  claiming: boolean;
  onClose: () => void;
  onClaim: () => Promise<unknown>;
}) {
  const completed = task.status === "completed";
  const claimable = completed && task.rewardCoins > 0 && task.isClaimed === false;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-[430px] rounded-t-[28px] border-t border-white/10 bg-[#120d1c]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 fill-[#ffc83d] text-[#ffe08a]" />
            <h3 className="text-[17px] font-bold text-white">Star Target</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-white/5 p-3.5">
          <p className="text-[14px] font-semibold text-white">{task.title}</p>
          <p className="mt-0.5 text-[13px] text-white/60">
            {task.currentValue} / {task.targetValue} coins gifted · {Math.floor(task.progress)}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(task.progress, 2)}%`, background: "linear-gradient(90deg,#ff4d8d,#ffb347 60%,#ffe08a)" }}
            />
          </div>
          {task.rewardCoins > 0 && (
            <p className="mt-2 text-[12.5px] font-medium text-[#ffd27a]">
              Everyone in the room gets +{task.rewardCoins} coins when the target is reached.
            </p>
          )}
        </div>

        {claimable && (
          <button
            type="button"
            disabled={claiming}
            onClick={() => void onClaim()}
            className="flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-[#2a1a00] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#ffe08a,#f5b93f)" }}
          >
            {claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : `Claim +${task.rewardCoins} coins`}
          </button>
        )}
        {completed && task.isClaimed === true && task.rewardCoins > 0 && (
          <p className="text-center text-[13px] font-semibold text-white/50">Reward claimed</p>
        )}
      </div>
    </div>
  );
}