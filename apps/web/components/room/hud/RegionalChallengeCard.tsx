"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { challengesApi, type ChallengeStanding, type RoomChallenge } from "@/lib/api/challenges";
import { useCountdown } from "@/hooks/useRoomChallenge";

/** Winged-star emblem (pure vector artwork, no data). */
function WingedStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden>
      <defs>
        <linearGradient id="rsc-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd9a0" />
          <stop offset="1" stopColor="#d9822b" />
        </linearGradient>
        <linearGradient id="rsc-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7ad9" />
          <stop offset="1" stopColor="#b52bd1" />
        </linearGradient>
      </defs>
      <path d="M32 30 C22 14 8 12 2 18 C8 20 10 26 8 32 C14 28 20 30 24 36 Z" fill="url(#rsc-wing)" />
      <path d="M32 30 C42 14 56 12 62 18 C56 20 54 26 56 32 C50 28 44 30 40 36 Z" fill="url(#rsc-wing)" />
      <path
        d="M32 6 L38 22 L55 23 L42 34 L46 50 L32 41 L18 50 L22 34 L9 23 L26 22 Z"
        fill="url(#rsc-star)"
        stroke="#ffe3a6"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RegionalChallengeCard({
  data,
  skewMs,
  myHostId,
}: {
  data: RoomChallenge | null;
  skewMs: number;
  myHostId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { label, done } = useCountdown(data?.challenge.endsAt, skewMs);
  if (!data || done) return null;
  const c = data.challenge;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${c.title} ${c.subtitle}, ends in ${label}`}
        className="relative flex h-[64px] w-full items-center gap-1.5 overflow-hidden rounded-[18px] border border-[#b56bff]/70 px-2.5 text-left transition active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, rgba(92,30,178,0.9), rgba(40,14,92,0.85))",
          boxShadow: "0 0 16px rgba(160,80,255,0.36), inset 0 0 18px rgba(190,120,255,0.12)",
        }}
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[2px]">
          <span className="block truncate text-[11px] font-bold leading-[1.2] text-white">{c.title}</span>
          <span className="block truncate text-[10px] font-medium leading-[1.2] text-[#d9b8ff]">{c.subtitle}</span>
          <span className="mt-[3px] inline-flex w-fit items-center rounded-[5px] bg-black/30 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none tabular-nums text-white">
            {label}
          </span>
        </span>
        <span className="flex h-full shrink-0 flex-col items-center justify-between py-2">
          <WingedStar className="h-[28px] w-[32px] drop-shadow-[0_0_6px_rgba(255,120,220,0.6)]" />
          <ChevronRight className="h-3.5 w-3.5 text-white/80" />
        </span>
      </button>

      {open && <ChallengeSheet data={data} skewMs={skewMs} myHostId={myHostId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChallengeSheet({
  data,
  skewMs,
  myHostId,
  onClose,
}: {
  data: RoomChallenge;
  skewMs: number;
  myHostId: string | null;
  onClose: () => void;
}) {
  const c = data.challenge;
  const { label } = useCountdown(c.endsAt, skewMs);
  const [rows, setRows] = useState<ChallengeStanding[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    challengesApi
      .leaderboard(c.id, 20, data.hostStanding?.hostId ?? undefined)
      .then((r) => !cancelled && setRows(r.standings))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [c.id, data.hostStanding?.hostId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[78svh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-t border-[#b56bff]/30 bg-[#150d26]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <WingedStar className="h-12 w-14" />
            <div>
              <h3 className="text-[18px] font-bold leading-tight text-white">
                {c.title} {c.subtitle}
              </h3>
              <p className="text-[13px] font-medium text-[#d9b8ff]">{c.country ?? "All regions"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
          <span className="text-[13px] text-white/60">Ends in</span>
          <span className="text-[17px] font-bold tabular-nums text-white">{label}</span>
        </div>
        {c.rewardText && <p className="mb-3 text-[13px] font-medium text-[#ffd27a]">🏆 {c.rewardText}</p>}

        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/45">Ranking · diamonds earned</p>
        {!rows && !failed && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-white/60" />}
        {failed && <p className="py-6 text-center text-[13px] text-white/50">Couldn&apos;t load the ranking.</p>}
        {rows && rows.length === 0 && (
          <p className="py-6 text-center text-[13px] text-white/50">No diamonds earned yet. Be the first on the board!</p>
        )}
        <div className="space-y-1.5">
          {rows?.map((r) => {
            const mine = r.hostId === (myHostId ?? data.hostStanding?.hostId);
            return (
              <div
                key={r.hostId}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                  mine ? "bg-[#7a2fe0]/30 ring-1 ring-[#b56bff]/60" : "bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                    r.rank === 1 ? "bg-[#ffc83d] text-[#3a2600]" : r.rank === 2 ? "bg-[#cfd8e6] text-[#1c2430]" : r.rank === 3 ? "bg-[#e0a070] text-[#331a05]" : "bg-white/10 text-white/70",
                  )}
                >
                  {r.rank}
                </span>
                <Avatar name={r.name} src={r.avatar ?? undefined} size="sm" className="!h-9 !w-9" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                  {r.name} {r.countryFlag}
                </span>
                <span className="text-[14px] font-bold tabular-nums text-white">{r.totalDiamonds.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}