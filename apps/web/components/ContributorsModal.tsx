// components/ContributorsModal.tsx
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Coins, Loader2, RotateCcw, Trophy, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  financialApi,
  type ContributorPeriod,
  type HostContributor,
} from "@/lib/api/financial";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ContributorsModalProps {
  hostId: string;
  hostName: string;
  onClose: () => void;
}

const TABS: Array<{ key: ContributorPeriod; label: string; caption: string }> = [
  { key: "daily", label: "Daily", caption: "Resets every day at 12:00 AM IST" },
  { key: "weekly", label: "Weekly", caption: "Resets every Monday at 12:00 AM IST" },
  { key: "monthly", label: "Monthly", caption: "Resets on the 1st of each month" },
  { key: "overall", label: "Overall", caption: "All-time supporters" },
];

type PeriodState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: HostContributor[]; fetchedAt: number };

const STALE_AFTER_MS = 30_000;

/**
 * "Top contributors" leaderboard for the room's host: who has gifted them
 * the most, by day / week / month / all-time. Opened from the trophy icon
 * in the room header — it never renders inline in the room itself.
 *
 * Layout: #1 gets a crowned centre-stage spot, #2 and #3 flank it on
 * lower podium steps, and everyone else follows in a ranked list.
 */
export function ContributorsModal({ hostId, hostName, onClose }: ContributorsModalProps) {
  const [period, setPeriod] = useState<ContributorPeriod>("daily");
  const [byPeriod, setByPeriod] = useState<Partial<Record<ContributorPeriod, PeriodState>>>({});
  // Mirror of state so `load` can check freshness without stale closures.
  const byPeriodRef = useRef(byPeriod);
  useEffect(() => {
    byPeriodRef.current = byPeriod;
  }, [byPeriod]);

  const load = useCallback(
    async (target: ContributorPeriod, force = false) => {
      const current = byPeriodRef.current[target];
      if (
        !force &&
        current?.status === "ready" &&
        Date.now() - current.fetchedAt < STALE_AFTER_MS
      ) {
        return;
      }

      // Keep showing stale data while refreshing; only show the spinner
      // when there's nothing on screen for this tab yet.
      if (current?.status !== "ready") {
        setByPeriod((prev) => ({ ...prev, [target]: { status: "loading" } }));
      }

      try {
        const data = await financialApi.hostContributors(hostId, target, 50);
        setByPeriod((prev) => ({
          ...prev,
          [target]: { status: "ready", data, fetchedAt: Date.now() },
        }));
      } catch {
        setByPeriod((prev) =>
          prev[target]?.status === "ready" ? prev : { ...prev, [target]: { status: "error" } },
        );
      }
    },
    [hostId],
  );

  useEffect(() => {
    void load(period);
  }, [load, period]);

  // Lock background scroll + close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const state = byPeriod[period] ?? { status: "loading" as const };
  const activeTab = TABS.find((t) => t.key === period) ?? TABS[0];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Top contributors for ${hostName}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[86dvh] w-full max-w-[390px] flex-col overflow-hidden rounded-[30px] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-200"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(255,196,70,0.22), transparent 60%), linear-gradient(180deg, #221737 0%, #150f26 55%, #0c0819 100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight text-white">
              <Trophy className="h-4.5 w-4.5 text-[#FFC94A]" strokeWidth={2.2} />
              Top Contributors
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-white/55">
              Supporters of <span className="font-semibold text-white/80">{hostName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Period tabs */}
        <div className="px-5 pt-4">
          <div role="tablist" className="grid grid-cols-4 gap-1 rounded-full bg-black/35 p-1">
            {TABS.map((tab) => {
              const active = tab.key === period;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setPeriod(tab.key)}
                  className={cn(
                    "rounded-full py-1.5 text-[12px] font-bold transition-all duration-200",
                    active
                      ? "bg-gradient-to-b from-[#FFE08A] to-[#F2A81D] text-[#3a2500] shadow-[0_2px_10px_rgba(255,190,60,0.4)]"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10.5px] text-white/40">{activeTab.caption}</p>
        </div>

        {/* Body */}
        <div className="min-h-[300px] flex-1 overflow-y-auto overscroll-contain pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {state.status === "loading" ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#FFC94A]" />
            </div>
          ) : state.status === "error" ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-3 px-8 text-center">
              <p className="text-sm text-white/70">Couldn&apos;t load the leaderboard.</p>
              <button
                type="button"
                onClick={() => void load(period, true)}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : state.data.length === 0 ? (
            <EmptyBoard period={period} />
          ) : (
            <Board contributors={state.data} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board = podium (top 3) + list (4+)
// ---------------------------------------------------------------------------

function Board({ contributors }: { contributors: HostContributor[] }) {
  const [first, second, third] = contributors;
  const rest = contributors.slice(3);

  return (
    <>
      <div className="flex items-end justify-center gap-2 px-4 pb-1 pt-9">
        <PodiumSlot rank={2} entry={second} />
        <PodiumSlot rank={1} entry={first} />
        <PodiumSlot rank={3} entry={third} />
      </div>

      {rest.length > 0 && (
        <ul className="mx-4 mt-3 space-y-1.5">
          {rest.map((c) => (
            <li
              key={c.userId}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-3 py-2"
            >
              <span className="w-6 text-center text-[13px] font-extrabold tabular-nums text-white/45">
                {c.rank}
              </span>
              <Avatar name={c.name} src={c.avatar ?? undefined} size="sm" className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{c.name}</p>
                <LevelChip level={c.level} />
              </div>
              <CoinAmount value={c.totalCoins} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const PODIUM = {
  1: {
    ring: "linear-gradient(160deg,#FFF1A8,#FFC93C 45%,#E58A00)",
    step: "linear-gradient(180deg,#FFD65C,#E29A0C 70%,#B36A00)",
    stepH: "h-[62px]",
    avatar: "h-[84px] w-[84px]",
    text: "text-[#3a2500]",
    glow: "0 0 34px rgba(255,196,70,0.55)",
    chip: "linear-gradient(180deg,#FFE58A,#F2A81D)",
  },
  2: {
    ring: "linear-gradient(160deg,#F4F7FB,#B9C3D1 50%,#7D8898)",
    step: "linear-gradient(180deg,#D5DCE6,#98A3B3 70%,#727D8E)",
    stepH: "h-[44px]",
    avatar: "h-[62px] w-[62px]",
    text: "text-[#232a35]",
    glow: "0 0 22px rgba(190,205,225,0.35)",
    chip: "linear-gradient(180deg,#F1F4F9,#A7B2C2)",
  },
  3: {
    ring: "linear-gradient(160deg,#FFD9B0,#D98A4A 50%,#9A5424)",
    step: "linear-gradient(180deg,#E3A56E,#B96F35 70%,#874A1F)",
    stepH: "h-[34px]",
    avatar: "h-[62px] w-[62px]",
    text: "text-[#2f1a08]",
    glow: "0 0 22px rgba(217,138,74,0.35)",
    chip: "linear-gradient(180deg,#F3BE8A,#C07B3E)",
  },
} as const;

function PodiumSlot({ rank, entry }: { rank: 1 | 2 | 3; entry?: HostContributor }) {
  const style = PODIUM[rank];
  const isFirst = rank === 1;

  return (
    <div className={cn("flex min-w-0 flex-col items-center", isFirst ? "w-[118px]" : "w-[92px]")}>
      <div className="relative flex flex-col items-center">
        {/* Crown floats above the champion only */}
        {isFirst && (
          <div className="pointer-events-none absolute -top-[34px] z-10 animate-float-slow">
            <Crown />
          </div>
        )}
        {isFirst && entry && (
          <>
            <span className="pointer-events-none absolute -left-3 top-2 text-[13px] text-[#FFE58A] animate-pulse">
              ✦
            </span>
            <span
              className="pointer-events-none absolute -right-2 top-8 text-[10px] text-[#FFE58A] animate-pulse"
              style={{ animationDelay: "0.6s" }}
            >
              ✦
            </span>
          </>
        )}

        {/* Avatar in a metal ring */}
        <div
          className="rounded-full p-[3px]"
          style={{ background: style.ring, boxShadow: entry ? style.glow : "none" }}
        >
          {entry ? (
            <Avatar
              name={entry.name}
              src={entry.avatar ?? undefined}
              size="md"
              className={cn(style.avatar, "border-2 border-[#150f26]")}
            />
          ) : (
            <div
              className={cn(
                style.avatar,
                "flex items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-black/30 text-lg text-white/25",
              )}
            >
              ?
            </div>
          )}
        </div>

        {/* Rank chip overlapping the avatar's bottom edge */}
        <span
          className={cn(
            "-mt-3 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-black shadow-md ring-2 ring-[#150f26]",
            style.text,
          )}
          style={{ background: style.chip }}
        >
          {rank}
        </span>
      </div>

      <p
        className={cn(
          "mt-1.5 w-full truncate text-center font-bold",
          isFirst ? "text-[14px] text-white" : "text-[12.5px] text-white/90",
          !entry && "text-white/30",
        )}
      >
        {entry?.name ?? "—"}
      </p>
      <div className="mt-0.5 h-4">
        {entry ? <CoinAmount value={entry.totalCoins} small /> : null}
      </div>

      {/* Podium step */}
      <div
        className={cn(
          "mt-2 flex w-full items-start justify-center rounded-t-2xl pt-1.5",
          style.stepH,
        )}
        style={{
          background: style.step,
          opacity: entry ? 1 : 0.35,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35)",
        }}
      >
        <span className={cn("text-[20px] font-black leading-none opacity-60", style.text)}>
          {rank}
        </span>
      </div>
    </div>
  );
}

function Crown() {
  const uid = useId().replace(/:/g, "");
  const gold = `crown-gold-${uid}`;
  return (
    <svg
      width="54"
      height="40"
      viewBox="0 0 64 46"
      aria-hidden
      style={{ filter: "drop-shadow(0 3px 8px rgba(255,190,50,0.65))" }}
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.5" stopColor="#FFCB3D" />
          <stop offset="1" stopColor="#E08A00" />
        </linearGradient>
      </defs>
      <path
        d="M5 36 L8 12 L21 24 L32 6 L43 24 L56 12 L59 36 Z"
        fill={`url(#${gold})`}
        stroke="#B36B00"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect
        x="5"
        y="35"
        width="54"
        height="8"
        rx="3.5"
        fill={`url(#${gold})`}
        stroke="#B36B00"
        strokeWidth="1.6"
      />
      <circle cx="8" cy="11" r="3.2" fill="#FFF8D6" stroke="#B36B00" strokeWidth="1" />
      <circle cx="32" cy="5.5" r="3.6" fill="#FFF8D6" stroke="#B36B00" strokeWidth="1" />
      <circle cx="56" cy="11" r="3.2" fill="#FFF8D6" stroke="#B36B00" strokeWidth="1" />
      <circle cx="32" cy="39" r="2.4" fill="#FF4D7D" />
      <circle cx="19" cy="39" r="1.8" fill="#5CC8FF" />
      <circle cx="45" cy="39" r="1.8" fill="#5CC8FF" />
      <path d="M12 33 L15 20 L21 27" fill="none" stroke="#FFF8D6" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CoinAmount({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-extrabold tabular-nums text-[#FFC94A]",
        small ? "text-[11.5px]" : "text-[13px]",
      )}
    >
      <Coins className={small ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.4} />
      {formatCompact(value)}
    </span>
  );
}

function LevelChip({ level }: { level: number }) {
  return (
    <span
      className="mt-0.5 inline-flex items-center rounded-[4px] bg-white/10 px-1 py-[1px] text-[9.5px] font-bold leading-none text-[#FFD24B]"
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,210,75,0.35)" }}
    >
      Lv.{level}
    </span>
  );
}

function EmptyBoard({ period }: { period: ContributorPeriod }) {
  const when =
    period === "daily"
      ? "today"
      : period === "weekly"
        ? "this week"
        : period === "monthly"
          ? "this month"
          : "yet";
  return (
    <div className="flex h-[300px] flex-col items-center justify-center px-8 text-center">
      <div className="opacity-40 grayscale">
        <Crown />
      </div>
      <p className="mt-3 text-[14px] font-bold text-white/85">No contributors {when}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">
        Send a gift to take the top spot on the podium.
      </p>
    </div>
  );
}