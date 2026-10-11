"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Infinity as InfinityIcon, Loader2, ShieldAlert, X } from "lucide-react";
import type { AdminUser, BanInput } from "@/lib/api/admin-users";
import { UserAvatar } from "@/components/admin/users/UserAvatar";

const PRESETS: Array<{ label: string; hours: number }> = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

const REASONS = ["Harassment or abuse", "Spam or scams", "Inappropriate content", "Fraud / payment abuse", "Underage user", "Cheating or exploiting"];

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function humanDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d} days` : `${Math.round(d / 30)} months`;
}

const field =
  "w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none";

export function BanDialog({
  user,
  saving,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  saving: boolean;
  onClose: () => void;
  onConfirm: (input: BanInput) => void;
}) {
  const [type, setType] = useState<"temporary" | "permanent">("temporary");
  const [until, setUntil] = useState(() => toLocalInput(new Date(Date.now() + 72 * 3600_000)));
  const [reason, setReason] = useState("");

  const untilDate = useMemo(() => new Date(until), [until]);
  const ms = untilDate.getTime() - Date.now();
  const dateOk = !Number.isNaN(ms) && ms >= 60_000;
  const valid = reason.trim().length >= 3 && (type === "permanent" || dateOk);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2A2238] bg-[#120e1b] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2A2238] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h3 className="text-[15px] font-semibold text-[#F3ECE0]">Ban user</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#9088A0] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
            <UserAvatar name={user.name} src={user.avatar} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#F3ECE0]">{user.name}</p>
              <p className="truncate text-[12px] text-[#9088A0]">
                @{user.handle}
                {user.publicId ? ` · ID ${user.publicId}` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "temporary", label: "Temporary", sub: "Ends on a date you choose", icon: CalendarClock },
                { id: "permanent", label: "Permanent", sub: "Never lifts on its own", icon: InfinityIcon },
              ] as const
            ).map(({ id, label, sub, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`rounded-xl border p-3 text-left transition ${
                  type === id ? "border-red-400/70 bg-red-500/10" : "border-[#2A2238] bg-[#17131F] hover:border-[#3a3050]"
                }`}
              >
                <Icon className={`mb-1.5 h-5 w-5 ${type === id ? "text-red-300" : "text-[#9088A0]"}`} />
                <p className="text-[13px] font-semibold text-[#F3ECE0]">{label}</p>
                <p className="text-[11px] text-[#9088A0]">{sub}</p>
              </button>
            ))}
          </div>

          {type === "temporary" && (
            <div className="space-y-2.5">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">Ban ends</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setUntil(toLocalInput(new Date(Date.now() + p.hours * 3600_000)))}
                    className="rounded-full border border-[#2A2238] bg-[#17131F] px-3 py-1 text-[12px] font-medium text-[#C9C0D8] hover:border-[#CBA35C]/50 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={until}
                min={toLocalInput(new Date(Date.now() + 60_000))}
                onChange={(e) => setUntil(e.target.value)}
                className={field}
              />
              <p className={`text-[12px] ${dateOk ? "text-[#9088A0]" : "text-red-300"}`}>
                {dateOk
                  ? `Banned for ${humanDuration(ms)} — until ${untilDate.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}.`
                  : "Pick a date and time at least a minute from now."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
              Reason <span className="normal-case text-[#5E5570]">(shown to the user)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-full border border-[#2A2238] bg-[#17131F] px-2.5 py-1 text-[11.5px] text-[#C9C0D8] hover:text-white"
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tell the user why their account was banned"
              className={`${field} resize-none`}
            />
          </div>

          <div className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-200/90">
            Takes effect immediately: they&apos;re blocked from every API route, see a ban screen they can&apos;t dismiss, and any live
            they&apos;re hosting is ended.
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#2A2238] px-5 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-[#2A2238] px-5 text-[13px] font-semibold text-[#C9C0D8] hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() =>
              onConfirm({
                type,
                reason: reason.trim(),
                ...(type === "temporary" ? { until: untilDate.toISOString() } : {}),
              })
            }
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-red-500 text-[13px] font-bold text-white transition hover:bg-red-500/90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : type === "permanent" ? "Ban permanently" : "Ban until selected date"}
          </button>
        </div>
      </div>
    </div>
  );
}
