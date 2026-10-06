"use client";

// Right-hand sidebar that explains the seat-unlock ladder of a party room:
// one card per level with a miniature chair in that level's colour, the seats
// it opens, the room coins needed, and live progress toward the next level.

import { AnimatePresence, motion } from "framer-motion";
import { Check, Coins, Crown, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageChair, chairPalette, type ChairTone } from "./StageChair";
import {
  COINS_PER_UNLOCK,
  coinsToUnlockSeat,
  formatLakh,
  seatTiers,
  unlockedSeatCount,
} from "@/lib/party-seats";

const TIER_TONES: ChairTone[] = ["violet", "cyan", "rose"];

interface SeatLevelsDrawerProps {
  open: boolean;
  onClose: () => void;
  roomCoins: number;
  seatCount: number;
}

export function SeatLevelsDrawer({ open, onClose, roomCoins, seatCount }: SeatLevelsDrawerProps) {
  const unlocked = unlockedSeatCount(roomCoins, seatCount);
  const tiers = seatTiers(seatCount);
  const allOpen = unlocked >= seatCount;
  // First tier that is not fully open yet = "next up".
  const nextTier = tiers.findIndex((t) => t[t.length - 1] >= unlocked);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="seat-levels-scrim"
            className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="seat-levels-panel"
            role="dialog"
            aria-label="Seat levels"
            className="absolute inset-y-0 right-0 z-[71] flex w-[86%] max-w-[340px] flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,#2A1650_0%,#170F2E_45%,#0E0A18_100%)] shadow-[-18px_0_50px_rgba(0,0,0,0.55)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            {/* glows */}
            <span className="pointer-events-none absolute -right-16 -top-10 h-48 w-48 rounded-full bg-[#8B5CF6]/40 blur-[70px]" />
            <span className="pointer-events-none absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-[#FF4F93]/25 blur-[70px]" />

            <header className="relative flex items-start justify-between px-5 pb-3 pt-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#F5C96A]">Party room</p>
                <h2 className="mt-0.5 font-display text-2xl font-black tracking-tight text-white">Seat levels</h2>
                <p className="mt-1 text-xs text-white/60">Gifts sent in this room unlock more seats.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close seat levels"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* room coins summary */}
            <div className="relative mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-[#F5C96A]/25 bg-[#F5C96A]/10 px-3.5 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE29A] to-[#E0A030] shadow-[0_0_16px_rgba(245,201,106,0.5)]">
                <Coins className="h-4.5 w-4.5 text-[#3A2406]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Room coins</p>
                <p className="text-lg font-black leading-tight text-white">{formatLakh(roomCoins)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Seats open</p>
                <p className="text-lg font-black leading-tight text-[#F5C96A]">
                  {unlocked}
                  <span className="text-xs font-bold text-white/50">/{seatCount}</span>
                </p>
              </div>
            </div>

            <div className="relative flex-1 space-y-3 overflow-y-auto px-4 pb-8 pt-1">
              {/* Level 0 — host + starter seats */}
              <LevelCard
                tone="violet"
                state="open"
                title="Starter"
                seats={tiers[0]}
                requirement="Free"
                extra={
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#F5C96A]">
                    <Crown className="h-3 w-3" /> + Host seat
                  </span>
                }
                level={1}
              />

              {tiers.slice(1).map((tier, i) => {
                const ti = i + 1;
                const need = coinsToUnlockSeat(tier[0]);
                const isOpen = unlocked > tier[tier.length - 1];
                const isNext = !allOpen && ti === nextTier;
                const pct = isOpen
                  ? 100
                  : isNext
                    ? Math.min(100, Math.max(0, ((roomCoins - (need - COINS_PER_UNLOCK)) / COINS_PER_UNLOCK) * 100))
                    : 0;
                return (
                  <LevelCard
                    key={ti}
                    tone={TIER_TONES[ti % TIER_TONES.length]}
                    state={isOpen ? "open" : isNext ? "next" : "locked"}
                    title={`Level ${ti + 1}`}
                    seats={tier}
                    requirement={formatLakh(need)}
                    progress={pct}
                    remaining={isNext ? Math.max(0, need - roomCoins) : undefined}
                    level={ti + 1}
                  />
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function LevelCard({
  tone,
  state,
  title,
  seats,
  requirement,
  progress,
  remaining,
  extra,
  level,
}: {
  tone: ChairTone;
  state: "open" | "next" | "locked";
  title: string;
  seats: number[];
  requirement: string;
  progress?: number;
  remaining?: number;
  extra?: React.ReactNode;
  level: number;
}) {
  const c = chairPalette(tone);
  const locked = state === "locked";
  const first = seats[0] + 1;
  const last = seats[seats.length - 1] + 1;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-3.5 backdrop-blur-xl transition",
        locked ? "border-white/[0.06] bg-black/30" : "border-white/15 bg-white/[0.06]",
      )}
      style={
        state === "next"
          ? { borderColor: `${c.glow}88`, boxShadow: `0 0 26px ${c.glow}33` }
          : state === "open"
            ? { borderColor: `${c.glow}44` }
            : undefined
      }
    >
      {!locked && (
        <span className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full blur-3xl" style={{ background: `${c.glow}40` }} />
      )}

      <div className="relative flex items-center gap-3.5">
        {/* chair showcase */}
        <div className="relative h-[84px] w-[84px] shrink-0">
          <span className="absolute inset-3 rounded-full blur-xl" style={{ background: c.glow, opacity: locked ? 0.05 : 0.55 }} />
          <StageChair
            tone={tone}
            className="absolute inset-0 h-full w-full"
            style={{
              filter: locked
                ? "brightness(0.38) saturate(0.45) drop-shadow(0 6px 8px rgba(0,0,0,0.6))"
                : `drop-shadow(0 0 8px ${c.glow}cc) drop-shadow(0 6px 8px rgba(0,0,0,0.5)) saturate(1.25) brightness(1.08)`,
            }}
          />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#170F2E]",
              locked ? "bg-[#2B2640] text-white/60" : "text-white",
            )}
            style={locked ? undefined : { background: `linear-gradient(145deg, ${c.light}, ${c.dark})` }}
          >
            {state === "open" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : locked ? <Lock className="h-3 w-3" /> : <span className="text-[10px] font-black">{level}</span>}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("text-[15px] font-extrabold tracking-tight", locked ? "text-white/45" : "text-white")}>{title}</h3>
            {state === "open" && <Pill color={c.glow}>Unlocked</Pill>}
            {state === "next" && <Pill color={c.glow}>Next up</Pill>}
            {locked && <Pill muted>Locked</Pill>}
          </div>
          <p className={cn("mt-0.5 text-xs font-semibold", locked ? "text-white/35" : "text-white/70")}>
            {first === last ? `Seat ${first}` : `Seats ${first}–${last}`}
            <span className="text-white/35"> · {seats.length} seats</span>
          </p>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold", locked && "opacity-60")}
              style={{ color: c.trim, borderColor: `${c.glow}66`, background: `${c.glow}1f` }}
            >
              <Coins className="h-3 w-3" />
              {requirement}
            </span>
            {extra}
          </div>
        </div>
      </div>

      {state === "next" && (
        <div className="relative mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${c.dark}, ${c.mid}, ${c.light})` }}
              initial={false}
              animate={{ width: `${progress ?? 0}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-white/60">
            <b className="text-white">{formatLakh(remaining ?? 0)}</b> more coins to unlock
          </p>
        </div>
      )}
    </div>
  );
}

function Pill({ children, color, muted }: { children: React.ReactNode; color?: string; muted?: boolean }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide"
      style={muted ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" } : { background: `${color}26`, color }}
    >
      {children}
    </span>
  );
}