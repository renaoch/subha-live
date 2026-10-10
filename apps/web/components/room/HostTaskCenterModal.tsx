"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardList, Coins, Loader2, Lock, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostCenterData, HostTaskCategory, ViewerHostTask } from "@/lib/api/host-task";

type Gender = HostCenterData["gender"];

const TABS: { id: HostTaskCategory; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "special", label: "Special" },
];

/**
 * Male and female hosts get the same mechanics but a different look and
 * voice, and — more importantly — different TASKS: the server only sends
 * tasks whose target gender matches the host's profile.
 */
const THEME: Record<
  "male" | "female" | "neutral",
  { chip: string; accent: string; accentSoft: string; bar: string; btn: string; btnText: string; title: string; sub: string }
> = {
  female: {
    chip: "Female host",
    accent: "#ff6fa8",
    accentSoft: "rgba(255,111,168,0.14)",
    bar: "linear-gradient(90deg,#ff4d8d,#ff9ac0 60%,#ffe08a)",
    btn: "linear-gradient(135deg,#ff6fa8,#ff3f7f)",
    btnText: "#fff",
    title: "Host Missions",
    sub: "Shine on stream and earn rewards",
  },
  male: {
    chip: "Male host",
    accent: "#4cc9f0",
    accentSoft: "rgba(76,201,240,0.14)",
    bar: "linear-gradient(90deg,#3a86ff,#4cc9f0 60%,#9bf6ff)",
    btn: "linear-gradient(135deg,#4cc9f0,#3a86ff)",
    btnText: "#04121f",
    title: "Host Challenges",
    sub: "Hit your goals and level up your earnings",
  },
  neutral: {
    chip: "Host",
    accent: "#CBA35C",
    accentSoft: "rgba(203,163,92,0.14)",
    bar: "linear-gradient(90deg,#ff4d8d,#ffb347 60%,#ffe08a)",
    btn: "linear-gradient(135deg,#ffe08a,#f5b93f)",
    btnText: "#2a1a00",
    title: "Host Tasks",
    sub: "Complete tasks to earn rewards",
  },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n * 100) / 100}`;
}

function remaining(ms: number | null): string | null {
  if (ms === null) return null;
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function requirement(t: ViewerHostTask): { value: string; target: string; unit: string } {
  if (t.targetHours != null) return { value: fmt(t.progress.hours), target: fmt(t.targetHours), unit: "hours" };
  if (t.targetCoins != null) return { value: fmt(t.progress.coins), target: fmt(t.targetCoins), unit: "coins" };
  return { value: "0", target: "0", unit: "" };
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: HostCenterData | null;
  loading: boolean;
  claimingId: string | null;
  onClaim: (taskId: string) => void;
}

export function HostTaskCenterModal({ open, onClose, data, loading, claimingId, onClaim }: Props) {
  const [tab, setTab] = useState<HostTaskCategory>("daily");
  const gender: Gender = data?.gender ?? null;
  const theme = THEME[gender ?? "neutral"];

  const byTab = useMemo(() => {
    const groups: Record<HostTaskCategory, ViewerHostTask[]> = { daily: [], weekly: [], special: [] };
    for (const t of data?.tasks ?? []) (groups[t.category] ?? groups.daily).push(t);
    return groups;
  }, [data]);

  if (!open) return null;

  const list = byTab[tab];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={theme.title}
        className="flex max-h-[82dvh] w-full max-w-[430px] flex-col rounded-t-[28px] border-t border-white/10 bg-[#120d1c]/97 pt-4 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: theme.accentSoft }}>
              <ClipboardList className="h-5 w-5" style={{ color: theme.accent }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-white">{theme.title}</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: theme.accentSoft, color: theme.accent }}
                >
                  {theme.chip}
                </span>
              </div>
              <p className="text-[12px] text-white/50">{theme.sub}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-5 mt-4 flex gap-1 rounded-full bg-white/5 p-1" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = byTab[t.id].length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition",
                  active ? "text-white" : "text-white/50",
                )}
                style={active ? { background: theme.accentSoft, color: theme.accent } : undefined}
              >
                {t.label}
                {count > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-white/70">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
          {loading && !data ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
              <p className="text-[13px] font-semibold text-white/50">No {tab} tasks right now</p>
              <p className="mt-1 text-[12px] text-white/30">Check back soon — new tasks appear here.</p>
            </div>
          ) : (
            list.map((t) => <TaskRow key={t.id} t={t} theme={theme} claiming={claimingId === t.id} onClaim={onClaim} />)
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  t,
  theme,
  claiming,
  onClaim,
}: {
  t: ViewerHostTask;
  theme: (typeof THEME)["male"];
  claiming: boolean;
  onClaim: (taskId: string) => void;
}) {
  const claimed = t.state === "claimed";
  const completed = t.state === "completed" || claimed;
  const locked = t.state === "not_eligible";
  const percent = Math.max(0, Math.min(100, t.progress.percent));
  const req = requirement(t);
  const left = remaining(t.remainingMs);

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        completed ? "border-emerald-300/25 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.04]",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight text-white">{t.title}</p>
          {t.description ? <p className="mt-0.5 text-[12px] leading-snug text-white/50">{t.description}</p> : null}
        </div>
        {left && !claimed && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/70">
            <Timer className="h-3 w-3" />
            {left}
          </span>
        )}
      </div>

      {locked ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-white/50">
          <Lock className="h-3.5 w-3.5" /> Not available for your account
        </p>
      ) : (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(percent, completed ? 100 : 3)}%`, background: completed ? "#34d399" : theme.bar }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11.5px] font-semibold">
            <span className="text-white/85">
              {completed ? (
                <>
                  <Check className="mr-1 inline h-3 w-3 text-emerald-300" />
                  Completed
                </>
              ) : (
                <>
                  {req.value}
                  <span className="text-white/45">
                    /{req.target} {req.unit}
                  </span>
                </>
              )}
            </span>
            <span className={completed ? "text-emerald-300" : "text-white/50"}>{Math.round(percent)}%</span>
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {t.rewardAmount > 0 ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-black leading-none",
              claimed ? "bg-white/10 text-white/40" : "bg-[#F5B93F]/15 text-[#F5B93F]",
            )}
          >
            <Coins className="h-3.5 w-3.5" />+{fmt(t.rewardAmount)}
          </span>
        ) : (
          <span />
        )}

        {claimed ? (
          <span className="text-[12px] font-semibold text-emerald-300">Claimed</span>
        ) : t.state === "completed" && t.rewardAmount > 0 ? (
          <button
            type="button"
            disabled={claiming}
            onClick={() => onClaim(t.id)}
            className="flex h-9 min-w-[96px] items-center justify-center rounded-full px-4 text-[13px] font-black transition active:scale-95 disabled:opacity-70"
            style={{ background: theme.btn, color: theme.btnText }}
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
          </button>
        ) : null}
      </div>
    </div>
  );
}