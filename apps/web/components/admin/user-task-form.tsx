"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  type AdminTaskDurationType,
  type AdminTaskGender,
  type AdminTaskItem,
  type AdminTaskStatus,
  type CreateAdminTaskInput,
} from "@/lib/api/admin-user-task";

interface UserTaskFormProps {
  initial?: AdminTaskItem | null;
  submitting?: boolean;
  submitLabel: string;
  error?: string | null;
  onSubmit: (input: CreateAdminTaskInput) => void;
  onCancel?: () => void;
}

const inputClass =
  "w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]";

export function UserTaskForm({
  initial,
  submitting,
  submitLabel,
  error,
  onSubmit,
  onCancel,
}: UserTaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [durationType, setDurationType] = useState<AdminTaskDurationType>(
    (initial?.durationType as AdminTaskDurationType) ?? "daily",
  );
  const [targetCount, setTargetCount] = useState(
    String(initial?.targetCount ?? 1),
  );
  const [rewardCoins, setRewardCoins] = useState(
    String(initial?.reward.coins ?? 0),
  );
  const [rewardDiamonds, setRewardDiamonds] = useState(
    String(initial?.reward.diamonds ?? 0),
  );
  const [rewardExp, setRewardExp] = useState(String(initial?.reward.exp ?? 0));
  const [targetGender, setTargetGender] = useState<AdminTaskGender>(
    (initial?.targetGender as AdminTaskGender) ?? "all",
  );
  const [status, setStatus] = useState<AdminTaskStatus>(
    (initial?.status as AdminTaskStatus) ?? "active",
  );
  const [iconUrl, setIconUrl] = useState(initial?.icon ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function num(value: string, fallback = 0): number {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setLocalError("Give the task a title");

    const count = num(targetCount, 1);
    if (count <= 0) return setLocalError("Target count must be at least 1");

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
      durationType,
      targetCount: Math.round(count),
      rewardCoins: Math.round(num(rewardCoins)),
      rewardDiamonds: Math.round(num(rewardDiamonds)),
      rewardExp: Math.round(num(rewardExp)),
      targetGender,
      status,
      iconUrl: iconUrl.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Send 10 messages today"
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Chat in any room to complete this task"
          maxLength={500}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Repeats</label>
          <select
            value={durationType}
            onChange={(e) =>
              setDurationType(e.target.value as AdminTaskDurationType)
            }
            className={inputClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Audience</label>
          <select
            value={targetGender}
            onChange={(e) => setTargetGender(e.target.value as AdminTaskGender)}
            className={inputClass}
          >
            <option value="all">Everyone</option>
            <option value="male">Male users</option>
            <option value="female">Female users</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Target count</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={targetCount}
          onChange={(e) => setTargetCount(e.target.value)}
          placeholder="10"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Coins</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={rewardCoins}
            onChange={(e) => setRewardCoins(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Diamonds</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={rewardDiamonds}
            onChange={(e) => setRewardDiamonds(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>EXP</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={rewardExp}
            onChange={(e) => setRewardExp(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Icon URL (optional)</label>
        <input
          type="text"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminTaskStatus)}
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {(localError || error) && (
        <p className="text-[12px] text-red-400">{localError ?? error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-11 flex-1 rounded-full border border-[#2A2238] text-[13px] font-semibold text-[#D9D2E0] transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#CBA35C] text-[13px] font-semibold text-black transition hover:bg-[#CBA35C]/90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
