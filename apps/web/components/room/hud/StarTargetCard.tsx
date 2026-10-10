"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Star, X } from "lucide-react";
import type { RoomTask } from "@/lib/api/room-tasks";

/** Puffy, glossy 3D gold star (vector, no data) — matches the reference art. */
function GoldStar({ className }: { className?: string }) {
  const star = "M24 4 L29.6 16.6 L43.4 18 L33 27.2 L36.2 40.8 L24 33.6 L11.8 40.8 L15 27.2 L4.6 18 L18.4 16.6 Z";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden style={{ filter: "drop-shadow(0 2px 3px rgba(190,110,0,0.55))" }}>
      <defs>
        <linearGradient id="stc-body" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fff6b0" />
          <stop offset="0.45" stopColor="#ffd534" />
          <stop offset="1" stopColor="#f0970a" />
        </linearGradient>
        <radialGradient id="stc-shine" cx="0.35" cy="0.25" r="0.55">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* thick same-colour stroke with round joins = soft, puffy points */}
      <path d={star} fill="url(#stc-body)" stroke="url(#stc-body)" strokeWidth="5" strokeLinejoin="round" />
      <path d={star} fill="url(#stc-shine)" />
      <path d="M24 12 L26.4 17.6 L24 19 L21.6 17.6 Z" fill="#fffbe0" opacity="0.7" />
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
  const countLen = `${live.currentValue}/${live.targetValue}`.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Star Target ${live.currentValue} of ${live.targetValue}`}
        className="star-card relative flex h-[64px] w-full flex-col justify-center gap-[6px] rounded-[18px] px-2.5 text-left transition active:scale-[0.97]"
      >
        <span className="flex items-center gap-1.5">
          <GoldStar className="h-[30px] w-[30px] shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-medium leading-tight text-white">Star Target</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/85" />
            </span>
            <span
              className={`block truncate font-bold leading-tight tabular-nums text-white ${
                countLen > 11 ? "text-[11px]" : countLen > 9 ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {live.currentValue}/{live.targetValue}
            </span>
          </span>
        </span>
        <span className="star-track block h-[6px] w-full overflow-hidden rounded-full">
          <span
            className="block h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.min(100, Math.max(live.progress, 4))}%`,
              background: "linear-gradient(90deg,#ff3d8b 0%,#ff8a3d 55%,#ffe36a 100%)",
              boxShadow: "0 0 7px rgba(255,160,60,0.7)",
            }}
          />
        </span>
        <style jsx>{`
          .star-card {
            border: 1.5px solid transparent;
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025) 55%, rgba(0, 0, 0, 0.18)),
              linear-gradient(rgba(18, 13, 8, 0.86), rgba(18, 13, 8, 0.86)),
              linear-gradient(135deg, #fff1b8, #f5b93f 35%, rgba(255, 255, 255, 0.28) 62%, #f5b93f 85%, #ffe39a) border-box;
            background-clip: padding-box, padding-box, border-box;
            box-shadow:
              0 0 16px rgba(245, 185, 63, 0.34),
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              inset 0 0 20px rgba(245, 185, 63, 0.07);
            backdrop-filter: blur(14px);
          }
          .star-track {
            background: rgba(255, 255, 255, 0.13);
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
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