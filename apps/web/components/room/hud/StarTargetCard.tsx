"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Plus, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomTask, SetRoomTaskInput } from "@/lib/api/room-tasks";

interface StarTargetCardProps {
  task: RoomTask | null;
  isHost: boolean;
  saving: boolean;
  claiming: boolean;
  onSet: (input: SetRoomTaskInput) => Promise<unknown>;
  onCancel: () => Promise<unknown>;
  onClaim: () => Promise<unknown>;
}

/**
 * "Star Target 12650/20000" — the room's live gift goal. Progress comes from
 * the server: every gift sent in the room adds its coin value to the active
 * goal in one atomic SQL update (see bump_room_task).
 *
 * Host with no goal: sees a "Set Star Target" card. Viewers see nothing until
 * a goal exists. Tapping the card opens details (claim reward / edit / cancel).
 */
export function StarTargetCard({ task, isHost, saving, claiming, onSet, onCancel, onClaim }: StarTargetCardProps) {
  const [open, setOpen] = useState(false);
  const live = task && (task.status === "active" || task.status === "completed") ? task : null;

  if (!live && !isHost) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[58px] w-[148px] items-center gap-2 rounded-2xl border border-[#f5b93f]/70 bg-black/45 px-2.5 text-left backdrop-blur-xl transition active:scale-95"
        style={{ boxShadow: "0 0 14px rgba(245,185,63,0.22), inset 0 0 18px rgba(245,185,63,0.06)" }}
      >
        <Star className="h-[34px] w-[34px] shrink-0 fill-[#ffc83d] text-[#ffe08a] drop-shadow-[0_0_8px_rgba(255,200,60,0.7)]" strokeWidth={1.4} />
        {live ? (
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between">
              <span className="truncate text-[13px] font-bold leading-tight text-white">Star Target</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/70" />
            </span>
            <span className="block text-[12.5px] font-semibold leading-tight text-white/90">
              {live.currentValue}/{live.targetValue}
            </span>
            <span className="mt-1 block h-[5px] overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.max(live.progress, 3)}%`,
                  background: "linear-gradient(90deg,#ff4d8d,#ffb347 60%,#ffe08a)",
                }}
              />
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-bold text-white">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="leading-tight">Set Star Target</span>
          </span>
        )}
      </button>

      {open && (
        <StarTargetSheet
          task={live}
          isHost={isHost}
          saving={saving}
          claiming={claiming}
          onClose={() => setOpen(false)}
          onSet={onSet}
          onCancel={onCancel}
          onClaim={onClaim}
        />
      )}
    </>
  );
}

function StarTargetSheet({
  task,
  isHost,
  saving,
  claiming,
  onClose,
  onSet,
  onCancel,
  onClaim,
}: Omit<StarTargetCardProps, "task"> & { task: RoomTask | null; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "Star Target");
  const [target, setTarget] = useState(task ? String(task.targetValue) : "");
  const targetNum = Number(target);
  const valid = title.trim().length > 0 && Number.isInteger(targetNum) && targetNum > 0;
  const completed = task?.status === "completed";
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

        {task && (
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
        )}

        {claimable && (
          <button
            type="button"
            disabled={claiming}
            onClick={() => void onClaim()}
            className="mb-3 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-[#2a1a00] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#ffe08a,#f5b93f)" }}
          >
            {claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : `Claim +${task.rewardCoins} coins`}
          </button>
        )}
        {completed && task.isClaimed === true && task.rewardCoins > 0 && (
          <p className="mb-3 text-center text-[13px] font-semibold text-white/50">Reward claimed</p>
        )}

        {isHost && (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-white/70">{task ? "Start a new target" : "Set a coin target for this stream"}</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Title"
              className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3.5 text-[14px] text-white placeholder:text-white/40 focus:border-[#f5b93f]/60 focus:outline-none"
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="Target in coins (e.g. 20000)"
              className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3.5 text-[14px] text-white placeholder:text-white/40 focus:border-[#f5b93f]/60 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!valid || saving}
                onClick={async () => {
                  await onSet({ title: title.trim(), targetValue: targetNum });
                  onClose();
                }}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-bold text-white transition",
                  (!valid || saving) && "opacity-50",
                )}
                style={{ background: "linear-gradient(135deg,#ff4d8d,#ff1f5a)" }}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : task ? "Replace target" : "Start target"}
              </button>
              {task && task.status === "active" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    await onCancel();
                    onClose();
                  }}
                  className="h-12 rounded-full border border-white/20 px-5 text-[14px] font-semibold text-white/80"
                >
                  End
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
