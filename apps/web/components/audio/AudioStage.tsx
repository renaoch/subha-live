"use client";

// The premium audio party-room stage — a single-screen layout (no scrolling):
//   host spotlight  ->  coin-unlock progress  ->  3 tiers of seats  ->  listener strip
//
// Seats are gated by the room's coin total (see lib/party-seats.ts): 4 open at
// the start, then 3 more for every 10 lakh coins. Locked seats stay visible so
// everyone can see what the room is working toward. Occupied seats are always
// rendered from the AUTHORITATIVE `getStage` snapshot, even if they sit in a
// tier that is currently locked. Presentation only — audio flows through
// useWebRTC, seat allocation/requests through room-stage.service.ts.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Crown, Lock, MicOff, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StageChair, chairPalette, type ChairTone } from "./StageChair";
import type { StageSnapshotResult } from "@/lib/api/rooms";
import type { StageProfile } from "@/hooks/useRoomStage";
import {
  COINS_PER_UNLOCK,
  coinsToUnlockSeat,
  formatLakh,
  seatTiers,
  unlockedSeatCount,
} from "@/lib/party-seats";

interface AudioStageProps {
  stage: StageSnapshotResult;
  profiles: Record<string, StageProfile>;
  speakingIds: Set<string>;
  currentUserId: string | null;
  isHost: boolean;
  /** Total coins the room has received; drives which seats are unlocked. */
  roomCoins: number;
  onOpenSeats: () => void;
  onOpenProfile: (userId: string) => void;
}

const SPEAKING_FALLBACK_MS = 3500;
// Avatar size scales with viewport height so 3 tiers + host always fit on one screen.
const AV = "clamp(36px, 5.9svh, 52px)";
const HOST_AV = "clamp(50px, 8svh, 68px)";
// Chairs are squares sized off the avatar; the avatar sits in the backrest.
const CHAIR = "calc(var(--av) * 1.62)";
const HOST_CHAIR = "calc(var(--hav) * 1.7)";
// Guest chairs change colour per unlock tier, so a freshly opened row stands out.
const TIER_TONES: ChairTone[] = ["violet", "cyan", "rose"];

export function AudioStage({
  stage,
  profiles,
  speakingIds,
  currentUserId,
  isHost,
  roomCoins,
  onOpenSeats,
  onOpenProfile,
}: AudioStageProps) {
  const seatCount = stage.seatCount;
  const unlocked = unlockedSeatCount(roomCoins, seatCount);
  const occupied = stage.seats.filter((s) => s !== null).length;
  const tiers = seatTiers(seatCount);

  const hostProfile = profiles[stage.host.userId];
  const hostSpeaking = speakingFor(stage.host.userId, stage.host.speakingAt, speakingIds);

  // Celebrate when new seats open.
  const prevUnlocked = useRef(unlocked);
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    if (unlocked > prevUnlocked.current) {
      setBanner(`Seats ${prevUnlocked.current + 1}${unlocked > prevUnlocked.current + 1 ? `–${unlocked}` : ""} unlocked!`);
      const t = setTimeout(() => setBanner(null), 3200);
      prevUnlocked.current = unlocked;
      return () => clearTimeout(t);
    }
    prevUnlocked.current = unlocked;
  }, [unlocked]);

  const handleLockedTap = (index: number) => {
    const need = coinsToUnlockSeat(index);
    toast(`Seat ${index + 1} is locked`, {
      description: `Unlocks when the room reaches ${formatLakh(need)} coins`,
    });
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_-5%,hsl(var(--accent-violet)/0.45),transparent_52%),radial-gradient(circle_at_8%_92%,hsl(var(--accent-cyan)/0.16),transparent_50%),radial-gradient(circle_at_95%_80%,hsl(var(--accent-gold)/0.14),transparent_45%),linear-gradient(180deg,#261b42_0%,#170f2b_48%,#0a0714_100%)]">
      {/* Ambient light */}
      <span className="pointer-events-none absolute left-[-8%] top-[18%] h-40 w-40 rounded-full bg-accent-violet/25 blur-3xl animate-float-slow" />
      <span className="pointer-events-none absolute right-[-6%] top-[40%] h-40 w-40 rounded-full bg-accent-cyan/12 blur-3xl animate-float-slow" style={{ animationDelay: "1.4s" }} />
      {/* Spotlight cone over the host */}
      <div className="pointer-events-none absolute left-1/2 top-[70px] h-[300px] w-[300px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,201,106,0.20),transparent_65%)]" />

      <div className="relative flex h-full flex-col items-center px-3 pb-[140px] pt-[100px]" style={{ "--av": AV, "--hav": HOST_AV } as React.CSSProperties}>
        {/* Host */}
        <HostSeat
          profile={hostProfile}
          speaking={hostSpeaking}
          muted={stage.host.muted}
          isMe={stage.host.userId === currentUserId}
          onOpenProfile={() => onOpenProfile(stage.host.userId)}
        />

        {/* Unlock progress */}
        <UnlockCard roomCoins={roomCoins} unlocked={unlocked} seatCount={seatCount} />

        {/* Seats — 3 tiers, never scrolls */}
        <div className="mt-2 flex min-h-0 w-full flex-1 flex-col justify-evenly">
          {tiers.map((tier, ti) => (
            <div key={ti} className="flex items-start justify-center gap-x-1.5">
              {tier.map((index) => {
                const seat = stage.seats[index] ?? null;
                const tone = TIER_TONES[ti % TIER_TONES.length];
                if (seat) {
                  return (
                    <Seat
                      tone={tone}
                      key={`seat-${seat.userId}`}
                      userId={seat.userId}
                      seatIndex={index}
                      profile={profiles[seat.userId]}
                      speaking={speakingFor(seat.userId, seat.speakingAt, speakingIds)}
                      muted={seat.muted}
                      status={seat.status}
                      isMe={seat.userId === currentUserId}
                      onOpenProfile={() => onOpenProfile(seat.userId)}
                    />
                  );
                }
                if (index >= unlocked) {
                  return (
                    <LockedSeat
                      key={`lock-${index}`}
                      index={index}
                      tone={tone}
                      onTap={() => handleLockedTap(index)}
                    />
                  );
                }
                return <EmptySeat key={`empty-${index}`} index={index} tone={tone} onOpenSeats={onOpenSeats} />;
              })}
            </div>
          ))}
        </div>

        {/* Listener strip */}
        <div className="mt-2 flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/30 px-3 py-1.5 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold text-white/65">{formatCount(stage.listenerCount)} listening</span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] font-semibold text-[#E8C27A]/85">
            {occupied}/{unlocked} seats
          </span>
          {!isHost && stage.me.requestPending && (
            <span className="text-[11px] font-semibold text-violet-300/80">· request pending</span>
          )}
        </div>
      </div>

      {/* Unlock banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 top-[96px] z-30 flex justify-center"
          >
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F5C96A] to-[#FF8A5B] px-4 py-2 text-xs font-black text-black shadow-[0_8px_30px_rgba(245,201,106,0.45)]">
              <Sparkles className="h-3.5 w-3.5" />
              {banner}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes audio-seat-speak {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes audio-eq {
          0%,
          100% {
            transform: scaleY(0.25);
          }
          50% {
            transform: scaleY(1);
          }
        }
        @keyframes audio-breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.75;
          }
          50% {
            transform: scale(1.07);
            opacity: 1;
          }
        }
        @keyframes audio-twinkle {
          0%,
          100% {
            opacity: 0;
            transform: translateY(4px) scale(0.5);
          }
          50% {
            opacity: 1;
            transform: translateY(-6px) scale(1);
          }
        }
        @keyframes audio-halo {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes audio-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(220%);
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function speakingFor(userId: string, speakingAt: number, speakingIds: Set<string>): boolean {
  if (speakingIds.has(userId)) return true;
  if (speakingIds.size === 0) return speakingAt > Date.now() - SPEAKING_FALLBACK_MS;
  return false;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function UnlockCard({
  roomCoins,
  unlocked,
  seatCount,
}: {
  roomCoins: number;
  unlocked: number;
  seatCount: number;
}) {
  const allOpen = unlocked >= seatCount;
  const nextAt = allOpen ? 0 : coinsToUnlockSeat(unlocked);
  const pct = allOpen ? 100 : Math.min(100, ((roomCoins - (nextAt - COINS_PER_UNLOCK)) / COINS_PER_UNLOCK) * 100);
  const nextTo = Math.min(seatCount, unlocked + 3);

  return (
    <div className="relative mt-2 w-full max-w-[330px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5C96A]/20">
            <Coins className="h-3 w-3 text-[#F5C96A]" />
          </span>
          <span className="text-[12px] font-extrabold text-white">{formatLakh(roomCoins)}</span>
          <span className="text-[10px] font-medium text-white/45">room coins</span>
        </div>
        <span className="text-[10px] font-semibold text-white/60">
          {allOpen ? (
            "All seats unlocked"
          ) : (
            <>
              <Lock className="mr-0.5 inline h-2.5 w-2.5 -translate-y-px text-[#F5C96A]" />
              Seats {unlocked + 1}
              {nextTo > unlocked + 1 ? `–${nextTo}` : ""} at{" "}
              <b className="text-[#F5C96A]">{formatLakh(nextAt)}</b>
            </>
          )}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-[#B8863A] via-[#F5C96A] to-[#FFD36E]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        >
          <span
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{ animation: "audio-shimmer 2.2s ease-in-out infinite" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function HostSeat({
  profile,
  speaking,
  muted,
  isMe,
  onOpenProfile,
}: {
  profile?: StageProfile;
  speaking: boolean;
  muted: boolean;
  isMe: boolean;
  onOpenProfile: () => void;
}) {
  const name = profile?.name ?? "Host";
  return (
    <div className="mt-3 flex flex-col items-center">
      <div className="relative" style={{ width: HOST_CHAIR, height: HOST_CHAIR }}>
        {/* Rotating golden halo + soft aura */}
        <span
          className="absolute -inset-3 rounded-full opacity-60 blur-md"
          style={{
            background: "conic-gradient(from 0deg, transparent, #F5C96A 18%, transparent 36%, #FFD36E 60%, transparent 78%)",
            animation: "audio-halo 9s linear infinite",
          }}
        />
        <span className={cn("absolute inset-0 rounded-full bg-[#F5C96A]/25 blur-2xl", speaking && "animate-pulse")} />

        {/* Floating sparkles */}
        {[
          { l: "4%", t: "22%", d: "0s" },
          { l: "92%", t: "30%", d: "0.9s" },
          { l: "80%", t: "4%", d: "1.7s" },
        ].map((sp, i) => (
          <Sparkles
            key={i}
            className="absolute h-3 w-3 text-[#FFE29A]"
            style={{ left: sp.l, top: sp.t, animation: `audio-twinkle 2.6s ease-in-out ${sp.d} infinite` }}
          />
        ))}

        <StageChair tone="host" className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_rgba(245,201,106,0.35)]" />

        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "calc(var(--hav) * 0.18)", width: HOST_AV, height: HOST_AV }}>
          {speaking && <SpeakRing tone="host" />}
          <button type="button" onClick={onOpenProfile} className="relative z-10 h-full w-full" aria-label={`${name} host`}>
            <Avatar
              name={name}
              src={profile?.avatar ?? undefined}
              size="md"
              className={cn(
                "!h-full !w-full border-[3px] shadow-[0_8px_30px_rgba(245,201,106,0.45)] transition-transform duration-150",
                speaking ? "scale-[1.04] border-transparent" : "border-[#F5C96A]",
              )}
            />
          </button>
          {muted && <MuteBadge className="bottom-0 right-0 h-5 w-5" />}
        </div>

        {/* Crown floating over the crest */}
        <Crown className="absolute -top-3 left-1/2 z-20 h-6 w-6 -translate-x-1/2 fill-[#F5C96A] text-[#FFE29A] drop-shadow-[0_3px_8px_rgba(245,201,106,0.85)]" />
        {speaking && <Equalizer className="bottom-[17%]" />}
      </div>

      {/* Gold pedestal */}
      <span
        className="-mt-2 h-2.5 rounded-[50%] border border-[#FFE29A]/60 bg-gradient-to-b from-[#F5C96A] to-[#8A5A1C] shadow-[0_6px_20px_rgba(245,201,106,0.55)]"
        style={{ width: `calc(${HOST_CHAIR} * 0.9)` }}
      />
      <div className="mt-1 flex items-center gap-1.5">
        <span className="rounded-full bg-gradient-to-r from-[#FFE29A] to-[#F5C96A] px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-black shadow-[0_2px_10px_rgba(245,201,106,0.5)]">Host</span>
        <p className="max-w-[130px] truncate text-[12.5px] font-extrabold text-white">{isMe ? "You" : name}</p>
      </div>
    </div>
  );
}

function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn("absolute left-1/2 z-10 flex h-2.5 -translate-x-1/2 items-end gap-[2px]", className)}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-full w-[2.5px] origin-bottom rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]"
          style={{ animation: `audio-eq 0.85s ease-in-out ${i * 0.13}s infinite` }}
        />
      ))}
    </span>
  );
}

const CELL = "flex flex-col items-center gap-0.5";
const CELL_STYLE = { width: CHAIR } as const;

/** Chair + avatar slot. `children` is rendered inside the backrest. */
function ChairSlot({
  tone,
  dim,
  index,
  speaking,
  children,
}: {
  tone: ChairTone;
  dim?: "empty" | "locked";
  index: number;
  speaking?: boolean;
  children: React.ReactNode;
}) {
  const pal = chairPalette(tone);
  return (
    <div
      className="relative"
      style={{ width: CHAIR, height: CHAIR, "--ring": pal.trim } as React.CSSProperties}
    >
      {/* colour halo behind the chair so it pops off the background */}
      <span
        className="pointer-events-none absolute inset-[6%] rounded-full blur-xl transition-opacity"
        style={{ background: pal.glow, opacity: dim === "locked" ? 0.25 : speaking ? 0.75 : 0.5 }}
      />
      {/* floor glow + speaking aura */}
      <span
        className="absolute bottom-[2%] left-[10%] right-[10%] h-[9%] rounded-full blur-md transition-opacity"
        style={{ background: pal.glow, opacity: dim === "locked" ? 0.3 : speaking ? 0.95 : 0.6 }}
      />
      {speaking && <span className="absolute inset-[4%] animate-pulse rounded-full blur-xl" style={{ background: pal.glow, opacity: 0.4 }} />}

      {/* Chair is fully opaque (no see-through) with a coloured rim glow */}
      <StageChair
        tone={tone}
        className="absolute inset-0 h-full w-full transition group-hover:brightness-110"
        style={{
          filter: `drop-shadow(0 0 7px ${pal.glow}${dim === "locked" ? "99" : "ff"}) drop-shadow(0 6px 8px rgba(0,0,0,0.5)) saturate(${dim === "locked" ? 0.7 : 1.3}) brightness(${dim === "locked" ? 1.05 : 1.08})`,
        }}
      />

      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "calc(var(--av) * 0.15)", width: AV, height: AV }}>
        {children}
      </div>

      {speaking ? (
        <Equalizer className="bottom-[17%]" />
      ) : (
        <span className="absolute bottom-[17%] left-1/2 z-10 -translate-x-1/2 text-[8px] font-black leading-none text-white/80 drop-shadow">
          {index + 1}
        </span>
      )}
    </div>
  );
}

function Seat({
  seatIndex,
  tone,
  profile,
  speaking,
  muted,
  status,
  isMe,
  onOpenProfile,
}: {
  userId: string;
  seatIndex: number;
  tone: ChairTone;
  profile?: StageProfile;
  speaking: boolean;
  muted: boolean;
  status: string;
  isMe: boolean;
  onOpenProfile: () => void;
}) {
  const name = profile?.name ?? `Guest ${seatIndex + 1}`;
  const reconnecting = status === "reconnecting" || status === "connecting";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={CELL}
      style={CELL_STYLE}
    >
      <ChairSlot index={seatIndex} tone={tone} speaking={speaking}>
        {speaking && <SpeakRing tone="guest" />}
        <button type="button" onClick={onOpenProfile} className="relative z-10 h-full w-full" aria-label={name}>
          <Avatar
            name={name}
            src={profile?.avatar ?? undefined}
            size="sm"
            className={cn(
              "!h-full !w-full border-2 shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform duration-150",
              speaking
                ? "scale-[1.05] border-transparent"
                : isMe
                  ? "border-[#F5C96A]"
                  : "border-[color:var(--ring)]",
            )}
          />
        </button>
        {muted && <MuteBadge className="-right-0.5 top-0 h-4 w-4" />}
        {reconnecting && <span className="absolute left-0 top-0 z-20 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black/50" />}
      </ChairSlot>
      <p className={cn("-mt-1 w-full truncate text-center text-[10.5px] font-semibold", isMe ? "text-[#F5C96A]" : "text-white/85")}>
        {isMe ? "You" : name}
      </p>
    </motion.div>
  );
}

function EmptySeat({ index, tone, onOpenSeats }: { index: number; tone: ChairTone; onOpenSeats: () => void }) {
  const c = chairPalette(tone);
  return (
    <motion.button
      type="button"
      onClick={onOpenSeats}
      initial={{ opacity: 0, scale: 0.6, rotate: -8, filter: "brightness(2.4)" }}
      animate={{ opacity: 1, scale: 1, rotate: 0, filter: "brightness(1)" }}
      transition={{ type: "spring", stiffness: 240, damping: 15, delay: index * 0.04 }}
      whileTap={{ scale: 0.92 }}
      className={cn(CELL, "group")}
      style={CELL_STYLE}
      aria-label={`Join seat ${index + 1}`}
    >
      <ChairSlot index={index} tone={tone} dim="empty">
        <span
          className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed transition group-hover:brightness-125"
          style={{ background: `radial-gradient(circle at 50% 30%, ${c.mid}88, ${c.dark}ee)`, borderColor: c.trim, animation: "audio-breathe 2.6s ease-in-out infinite", boxShadow: `0 0 14px ${c.glow}55` }}
        >
          <Plus className="h-5 w-5" style={{ color: c.trim }} strokeWidth={2.2} />
        </span>
      </ChairSlot>
      <span className="-mt-1 text-[10px] font-semibold" style={{ color: `${c.trim}aa` }}>
        Join
      </span>
    </motion.button>
  );
}

function LockedSeat({ index, tone, onTap }: { index: number; tone: ChairTone; onTap: () => void }) {
  const c = chairPalette(tone);
  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ x: [0, -3, 3, -2, 0], transition: { duration: 0.3 } }}
      className={CELL}
      style={CELL_STYLE}
      aria-label={`Seat ${index + 1} locked, unlocks at ${formatLakh(coinsToUnlockSeat(index))} room coins`}
    >
      <ChairSlot index={index} tone={tone} dim="locked">
        <span className="flex h-full w-full items-center justify-center rounded-full border border-white/20 shadow-inner" style={{ background: `radial-gradient(circle at 50% 30%, ${c.glow}55, #14101f 85%)` }}>
          <Lock className="h-4 w-4" style={{ color: c.trim, filter: `drop-shadow(0 0 5px ${c.glow})` }} strokeWidth={2.2} />
        </span>
      </ChairSlot>
      <span
        className="-mt-1 flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9.5px] font-extrabold"
        style={{ color: c.trim, borderColor: `${c.glow}66`, background: `${c.glow}1f` }}
      >
        <Coins className="h-2.5 w-2.5" />
        {formatLakh(coinsToUnlockSeat(index))}
      </span>
    </motion.button>
  );
}

function SpeakRing({ tone }: { tone: "host" | "guest" }) {
  const colors =
    tone === "host"
      ? "conic-gradient(from 0deg, #F5C96A, #FFD36E, #B8863A, #F5C96A)"
      : "conic-gradient(from 0deg, hsl(var(--accent-hot)), #FF8A5B, #FFD36E, hsl(var(--accent-hot)))";
  return (
    <>
      <span className="absolute -inset-1 animate-ping rounded-full bg-white/10" />
      <span
        className="absolute -inset-[3px] rounded-full"
        style={{ background: colors, padding: 2, animation: "audio-seat-speak 1.6s linear infinite" }}
      >
        <span className="block h-full w-full rounded-full bg-[#0a0714]" />
      </span>
    </>
  );
}

function MuteBadge({ className }: { className?: string }) {
  return (
    <span className={cn("absolute z-20 flex items-center justify-center rounded-full border border-black/50 bg-[#1a1a1e] text-white/80", className)}>
      <MicOff className="h-2.5 w-2.5" strokeWidth={2.4} />
    </span>
  );
}