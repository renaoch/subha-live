"use client";

// The premium audio party-room stage. Renders the host + guest seats from the
// AUTHORITATIVE `getStage` snapshot (seat layout, muted/status, listener &
// request counts), overlaying the real avatar in each chair. Speaking is driven
// by real audio-level detection (speakingIds) with a server `speakingAt`
// fallback. This is presentation only — audio flows through useWebRTC, seat
// allocation/requests through room-stage.service.ts.

import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StageChair } from "./StageChair";
import type { StageSnapshotResult } from "@/lib/api/rooms";
import type { StageProfile } from "@/hooks/useRoomStage";

interface AudioStageProps {
  stage: StageSnapshotResult;
  profiles: Record<string, StageProfile>;
  speakingIds: Set<string>;
  currentUserId: string | null;
  isHost: boolean;
  onOpenSeats: () => void;
  onOpenProfile: (userId: string) => void;
}

const SPEAKING_FALLBACK_MS = 3500;

export function AudioStage({
  stage,
  profiles,
  speakingIds,
  currentUserId,
  isHost,
  onOpenSeats,
  onOpenProfile,
}: AudioStageProps) {
  const hostProfile = profiles[stage.host.userId];
  const hostSpeaking = speakingFor(stage.host.userId, stage.host.speakingAt, speakingIds);
  const hostMuted = stage.host.muted;

  const occupied = stage.seats.filter((s) => s !== null).length;
  const seatCount = stage.seatCount;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_-5%,hsl(var(--accent-violet)/0.4),transparent_50%),radial-gradient(circle_at_8%_92%,hsl(var(--accent-cyan)/0.16),transparent_50%),radial-gradient(circle_at_95%_80%,hsl(var(--accent-gold)/0.12),transparent_45%),linear-gradient(180deg,#241a3d_0%,#170f2b_48%,#0a0714_100%)]">
      {/* Ambient glows */}
      <span className="pointer-events-none absolute left-[6%] top-[20%] h-28 w-28 rounded-full bg-accent-violet/25 blur-3xl animate-float-slow" />
      <span className="pointer-events-none absolute right-[8%] top-[38%] h-32 w-32 rounded-full bg-accent-cyan/12 blur-3xl animate-float-slow" style={{ animationDelay: "1.4s" }} />
      <span className="pointer-events-none absolute bottom-[12%] left-[45%] h-24 w-24 rounded-full bg-accent-gold/10 blur-3xl animate-float-slow" style={{ animationDelay: "2.6s" }} />

      {/* Faint floor line for depth */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[34%] h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

      <div className="relative flex h-full flex-col items-center px-5 pt-[104px]">
        {/* Host seat */}
        <HostSeat
          host={stage.host}
          profile={hostProfile}
          speaking={hostSpeaking}
          muted={hostMuted}
          isMe={stage.host.userId === currentUserId}
          onOpenProfile={() => onOpenProfile(stage.host.userId)}
        />

        {/* Guest seats */}
        <div className="mt-6 grid w-full max-w-[380px] grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4">
          {Array.from({ length: seatCount }).map((_, index) => {
            const seat = stage.seats[index] ?? null;
            if (!seat) {
              return <EmptySeat key={`empty-${index}`} onOpenSeats={onOpenSeats} />;
            }
            const profile = profiles[seat.userId];
            return (
              <Seat
                key={seat.userId}
                userId={seat.userId}
                seatIndex={seat.seat}
                profile={profile}
                speaking={speakingFor(seat.userId, seat.speakingAt, speakingIds)}
                muted={seat.muted}
                status={seat.status}
                isMe={seat.userId === currentUserId}
                onOpenProfile={() => onOpenProfile(seat.userId)}
              />
            );
          })}
        </div>

        {/* Listener / audience strip */}
        <div className="mt-auto mb-3 flex items-center gap-2 rounded-full border border-white/[0.06] bg-black/25 px-3 py-1.5 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold text-white/60">
            {formatCount(stage.listenerCount)} listening
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] font-semibold text-[#E8C27A]/80">
            {occupied}/{seatCount} seats
          </span>
          {!isHost && stage.me.requestPending && (
            <span className="text-[11px] font-semibold text-violet-300/80">· request pending</span>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes audio-seat-speak {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function speakingFor(
  userId: string,
  speakingAt: number,
  speakingIds: Set<string>,
): boolean {
  if (speakingIds.has(userId)) return true;
  if (speakingIds.size === 0) {
    return speakingAt > Date.now() - SPEAKING_FALLBACK_MS;
  }
  return false;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface ParticipantLike {
  userId: string;
  speakingAt: number;
}

function HostSeat({
  host,
  profile,
  speaking,
  muted,
  isMe,
  onOpenProfile,
}: {
  host: ParticipantLike;
  profile?: StageProfile;
  speaking: boolean;
  muted: boolean;
  isMe: boolean;
  onOpenProfile: () => void;
}) {
  const name = profile?.name ?? "Host";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-[112px] w-[104px] items-end justify-center">
        <StageChair tone="host" className="absolute inset-x-0 bottom-0 w-full" />
        {speaking && <SpeakRing className="absolute left-1/2 top-[10px] h-[76px] w-[76px] -translate-x-1/2" tone="host" />}
        <button
          type="button"
          onClick={onOpenProfile}
          className="absolute left-1/2 top-[6px] z-10 -translate-x-1/2"
          aria-label={`${name} host`}
        >
          <Avatar
            name={name}
            src={profile?.avatar ?? undefined}
            size="md"
            className={cn(
              "h-[72px] w-[72px] border-2 transition-transform duration-150",
              speaking ? "scale-[1.05] border-transparent" : "border-[#F5C96A]/60",
            )}
          />
        </button>
        {muted && <MuteBadge className="absolute bottom-6 right-2" />}
      </div>
      <span className="rounded-full bg-[#F5C96A]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#F5C96A]">
        HOST
      </span>
      <p className="max-w-[104px] truncate text-[12px] font-bold text-white">{isMe ? "You" : name}</p>
    </div>
  );
}

function Seat({
  userId,
  seatIndex,
  profile,
  speaking,
  muted,
  status,
  isMe,
  onOpenProfile,
}: {
  userId: string;
  seatIndex: number;
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-1"
    >
      <div className="relative flex h-[92px] w-[82px] items-end justify-center">
        <StageChair tone="guest" className="absolute inset-x-0 bottom-0 w-full" />
        {speaking && <SpeakRing className="absolute left-1/2 top-[8px] h-[58px] w-[58px] -translate-x-1/2" tone="guest" />}
        <button
          type="button"
          onClick={onOpenProfile}
          className="absolute left-1/2 top-[5px] z-10 -translate-x-1/2"
          aria-label={name}
        >
          <Avatar
            name={name}
            src={profile?.avatar ?? undefined}
            size="sm"
            className={cn(
              "h-[56px] w-[56px] border-2 transition-transform duration-150",
              speaking ? "scale-[1.06] border-transparent" : "border-white/25",
            )}
          />
        </button>
        {muted && <MuteBadge className="absolute bottom-5 right-1" />}
        {reconnecting && (
          <span className="absolute bottom-5 left-1 flex h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black/50" />
        )}
      </div>
      <p className={cn("max-w-[82px] truncate text-[11px] font-semibold", isMe ? "text-[#E8C27A]" : "text-white/80")}>
        {isMe ? "You" : name}
      </p>
    </motion.div>
  );
}

function EmptySeat({ onOpenSeats }: { onOpenSeats: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpenSeats}
      whileTap={{ scale: 0.94 }}
      className="group flex flex-col items-center gap-1"
      aria-label="Join a seat"
    >
      <div className="relative flex h-[92px] w-[82px] items-end justify-center opacity-55 transition-opacity group-hover:opacity-80">
        <StageChair tone="guest" className="absolute inset-x-0 bottom-0 w-full" />
        <span className="absolute left-1/2 top-[6px] flex h-[56px] w-[56px] -translate-x-1/2 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/[0.02]">
          <Mic className="h-5 w-5 text-white/25 transition-colors group-hover:text-[#E8C27A]/70" />
        </span>
        <span className="absolute -bottom-0.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#E8C27A]/90 text-[10px] font-black text-black opacity-0 transition-opacity group-hover:opacity-100">
          +
        </span>
      </div>
      <span className="text-[11px] font-medium text-white/30 transition-colors group-hover:text-white/60">Tap to join</span>
    </motion.button>
  );
}

function SpeakRing({ className, tone }: { className?: string; tone: "host" | "guest" }) {
  const colors =
    tone === "host"
      ? "conic-gradient(from 0deg, #F5C96A, #FFD36E, #B8863A, #F5C96A)"
      : "conic-gradient(from 0deg, hsl(var(--accent-hot)), #FF8A5B, #FFD36E, hsl(var(--accent-hot)))";
  return (
    <span
      className={cn("absolute rounded-full", className)}
      style={{ background: colors, padding: 2, animation: "audio-seat-speak 1.6s linear infinite" }}
    >
      <span className="block h-full w-full rounded-full bg-[#0a0714]" />
    </span>
  );
}

function MuteBadge({ className }: { className?: string }) {
  return (
    <span className={cn("absolute z-20 flex h-4 w-4 items-center justify-center rounded-full border border-black/50 bg-[#1a1a1e] text-white/70", className)}>
      <MicOff className="h-2.5 w-2.5" strokeWidth={2.4} />
    </span>
  );
}
