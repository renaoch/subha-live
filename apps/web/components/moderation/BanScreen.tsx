"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Hourglass, Loader2, LogOut, ShieldAlert } from "lucide-react";
import type { BanInfo } from "@/lib/ban-store";

function useCountdown(until: string | null, skewMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - (now + skewMs));
  const s = Math.floor(ms / 1000);
  return {
    done: ms <= 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[64px] flex-1 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] py-3">
      <span className="text-[26px] font-bold leading-none tabular-nums text-white">{String(value).padStart(2, "0")}</span>
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
    </div>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Full-screen, non-dismissable ban notice. There is deliberately no close
 * button, no backdrop click, no Escape handling — the only thing a banned user
 * can do here is sign out. (The API also refuses every request from a banned
 * account, so this screen is a courtesy, not the lock.)
 */
export function BanScreen({
  ban,
  skewMs,
  checking,
  onSignOut,
  signingOut,
  onExpired,
}: {
  ban: BanInfo;
  skewMs: number;
  checking: boolean;
  signingOut: boolean;
  onSignOut: () => void;
  /** Called once when a temporary ban's timer reaches zero, to re-check with the server. */
  onExpired: () => void;
}) {
  const countdown = useCountdown(ban.until, skewMs);
  const expired = !!countdown?.done;

  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  const title = ban.permanent ? "Your account has been banned" : "Your account is suspended";
  const subtitle = useMemo(
    () =>
      ban.permanent
        ? "This ban is permanent. You can no longer use Subha with this account."
        : "You can't use Subha until the suspension ends. Everything will be back to normal then.",
    [ban.permanent],
  );

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ban-title"
      aria-describedby="ban-desc"
      className="fixed inset-0 z-[2147483000] flex items-center justify-center overflow-y-auto bg-[#07050b] px-5 py-8"
      onKeyDown={(e) => {
        // Nothing dismisses this screen.
        if (e.key === "Escape") e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: ban.permanent
            ? "radial-gradient(60% 50% at 50% 0%, rgba(255,45,85,0.28), transparent 70%), radial-gradient(50% 40% at 50% 100%, rgba(120,20,60,0.35), transparent 70%)"
            : "radial-gradient(60% 50% at 50% 0%, rgba(255,160,40,0.26), transparent 70%), radial-gradient(50% 40% at 50% 100%, rgba(150,70,10,0.3), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="relative mx-auto mb-11 flex h-[92px] w-[92px] items-center justify-center">
          <span
            className="absolute h-[92px] w-[92px] animate-ping rounded-full opacity-30"
            style={{ background: ban.permanent ? "#ff2d55" : "#ffa028", animationDuration: "2.6s" }}
          />
          <span
            className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full"
            style={{
              background: ban.permanent
                ? "linear-gradient(145deg,#ff4d6d,#b3123a)"
                : "linear-gradient(145deg,#ffb347,#c46a0a)",
              boxShadow: ban.permanent ? "0 12px 40px rgba(255,45,85,0.45)" : "0 12px 40px rgba(255,160,40,0.4)",
            }}
          >
            {ban.permanent ? <ShieldAlert className="h-11 w-11 text-white" strokeWidth={1.8} /> : <Hourglass className="h-10 w-10 text-white" strokeWidth={1.8} />}
          </span>
        </div>

        <div className="text-center">
          <span
            className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{
              background: ban.permanent ? "rgba(255,45,85,0.16)" : "rgba(255,160,40,0.16)",
              color: ban.permanent ? "#ff8aa0" : "#ffc069",
            }}
          >
            {ban.permanent ? "Permanent ban" : "Temporary ban"}
          </span>
          <h1 id="ban-title" className="text-[26px] font-bold leading-tight text-white">
            {title}
          </h1>
          <p id="ban-desc" className="mx-auto mt-2 max-w-[340px] text-[14px] leading-relaxed text-white/60">
            {subtitle}
          </p>
        </div>

        {!ban.permanent && countdown && (
          <div className="mt-6">
            <div className="flex gap-2">
              <Tile value={countdown.days} label="Days" />
              <Tile value={countdown.hours} label="Hours" />
              <Tile value={countdown.minutes} label="Min" />
              <Tile value={countdown.seconds} label="Sec" />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-white/50">
              <CalendarClock className="h-3.5 w-3.5" />
              Ends {ban.until ? fmt(ban.until) : ""}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Reason</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-white/90">{ban.reason}</p>
          <p className="mt-3 border-t border-white/10 pt-3 text-[12px] text-white/40">Banned on {fmt(ban.bannedAt)}</p>
        </div>

        {expired && (
          <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-emerald-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Your ban has ended — checking your account…
          </p>
        )}

        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] text-[14px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sign out
        </button>
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-white/35">
          Think this is a mistake? Contact Subha support and mention your user ID.
          {checking ? " · Refreshing status…" : ""}
        </p>
      </div>
    </div>
  );
}
