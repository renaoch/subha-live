"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  type CreateHostTaskInput,
  type HostTaskAudience,
  type HostTaskConfig,
  type HostTaskStatus,
} from "@/lib/api/host-task";

interface HostTaskFormProps {
  initial?: HostTaskConfig | null;
  submitting?: boolean;
  submitLabel: string;
  error?: string | null;
  showStatus?: boolean;
  onSubmit: (
    input: CreateHostTaskInput & { status?: HostTaskStatus },
  ) => void;
  onCancel?: () => void;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]";

export function HostTaskForm({
  initial,
  submitting,
  submitLabel,
  error,
  showStatus,
  onSubmit,
  onCancel,
}: HostTaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [audience, setAudience] = useState<HostTaskAudience>(initial?.audience ?? "all");
  const [newUserWindowDays, setNewUserWindowDays] = useState(
    String(initial?.newUserWindowDays ?? 7),
  );
  const [targetHours, setTargetHours] = useState(
    initial?.targetHours != null ? String(initial.targetHours) : "",
  );
  const [targetCoins, setTargetCoins] = useState(
    initial?.targetCoins != null ? String(initial.targetCoins) : "",
  );
  const [rewardAmount, setRewardAmount] = useState(
    initial?.rewardAmount != null ? String(initial.rewardAmount) : "",
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initial?.expiresAt));
  const [maxClaims, setMaxClaims] = useState(
    initial?.maxClaims != null ? String(initial.maxClaims) : "",
  );
  const [status, setStatus] = useState<HostTaskStatus>(initial?.status ?? "active");
  const [localError, setLocalError] = useState<string | null>(null);

  function num(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setLocalError("Give the task a title");

    const hours = num(targetHours);
    const coins = num(targetCoins);
    if (hours == null && coins == null) {
      return setLocalError("Set at least one target: hours or coins");
    }

    const reward = num(rewardAmount) ?? 0;
    if (reward < 0) return setLocalError("Reward must be 0 or more");

    const windowDays = num(newUserWindowDays) ?? 7;
    const max = num(maxClaims);

    let startIso: string | undefined;
    let endIso: string | undefined;
    if (startsAt) startIso = new Date(startsAt).toISOString();
    if (expiresAt) endIso = new Date(expiresAt).toISOString();
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      return setLocalError("Expiration must be after the start time");
    }

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
      audience,
      newUserWindowDays: windowDays,
      targetHours: hours,
      targetCoins: coins,
      rewardAmount: Math.round(reward),
      startsAt: startIso,
      expiresAt: endIso,
      maxClaims: max,
      ...(showStatus ? { status } : {}),
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
          placeholder="Stream for 5 hours this week"
          maxLength={80}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Earn a reward for hitting the goal"
          maxLength={500}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Who can participate</label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as HostTaskAudience)}
          className={inputClass}
        >
          <option value="all">Everyone</option>
          <option value="new_users">New users only</option>
          <option value="existing_users">Existing users only</option>
        </select>
      </div>

      {audience !== "all" && (
        <div>
          <label className={labelClass}>New-user window (days)</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={newUserWindowDays}
            onChange={(e) => setNewUserWindowDays(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Target hours</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={targetHours}
            onChange={(e) => setTargetHours(e.target.value)}
            placeholder="5"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Target coins</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={targetCoins}
            onChange={(e) => setTargetCoins(e.target.value)}
            placeholder="1000"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Reward coins</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={rewardAmount}
          onChange={(e) => setRewardAmount(e.target.value)}
          placeholder="500"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Starts at</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Expires at</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Max claims (optional)</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={maxClaims}
          onChange={(e) => setMaxClaims(e.target.value)}
          placeholder="Unlimited"
          className={inputClass}
        />
      </div>

      {showStatus && (
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as HostTaskStatus)}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      )}

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
