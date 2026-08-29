// components/TaskManagerModal.tsx
"use client";

import { useState } from "react";
import { Loader2, Target, X } from "lucide-react";
import type { RoomTask } from "@/lib/api/room-tasks";

interface TaskManagerModalProps {
  task: RoomTask | null;
  saving: boolean;
  onClose: () => void;
  onSetTask: (input: { title: string; targetValue: number }) => Promise<unknown>;
  onCancelTask: () => Promise<unknown>;
}

/**
 * The host's side of the room task feature — reachable from Host
 * Controls in the room. Kept lightweight (title + a coin target) since
 * it's meant to be set in the middle of going live, not filled out
 * like a form.
 */
export function TaskManagerModal({
  task,
  saving,
  onClose,
  onSetTask,
  onCancelTask,
}: TaskManagerModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [targetValue, setTargetValue] = useState(
    task?.targetValue ? String(task.targetValue) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const hasActiveTask = task?.status === "active";

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const numericTarget = Number(targetValue);

    if (!trimmedTitle) {
      setError("Give the goal a title");
      return;
    }

    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setError("Enter a target greater than 0");
      return;
    }

    setError(null);

    try {
      await onSetTask({ title: trimmedTitle, targetValue: Math.round(numericTarget) });
      onClose();
    } catch {
      // Error toast already shown by the hook.
    }
  };

  const handleCancel = async () => {
    try {
      await onCancelTask();
      setTitle("");
      setTargetValue("");
    } catch {
      // Error toast already shown by the hook.
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-t-3xl border-t border-white/10 bg-[#111214] p-5 pb-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Target className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-[15px] font-semibold text-white">Room goal</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasActiveTask && (
          <p className="mb-3 text-[12px] text-white/50">
            Live now — {task?.currentValue ?? 0}/{task?.targetValue ?? 0}. Saving below
            replaces it with a new goal.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-white/40">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reach 5,000 coins tonight"
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-white/40">
              Target (coins)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="5000"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {hasActiveTask && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="h-11 flex-1 rounded-full border border-white/15 text-[13px] font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
            >
              End goal
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasActiveTask ? "Replace goal" : "Start goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
