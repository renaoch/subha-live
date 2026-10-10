"use client";

import { Gift, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveBoxStatus } from "@/lib/api/live-box";

function RailShell({
  onClick,
  label,
  children,
  glow,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  glow?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "relative flex h-[74px] w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl border bg-black/50 backdrop-blur-xl transition active:scale-90",
        glow ? "border-[#ff5c9a]/80" : "border-white/20",
      )}
      style={glow ? { boxShadow: "0 0 18px rgba(255,70,140,0.55)" } : undefined}
    >
      {children}
    </button>
  );
}

function Dot() {
  return <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#ff2d6a] ring-2 ring-black/70" />;
}

function fmt(ms: number) {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Watch-time gift box: countdown, badge = boxes left today, glows when ready. */
export function GiftBoxButton({
  status,
  remainingMs,
  ready,
  exhausted,
  claiming,
  onPress,
}: {
  status: LiveBoxStatus;
  remainingMs: number;
  ready: boolean;
  exhausted: boolean;
  claiming: boolean;
  onPress: () => void;
}) {
  return (
    <RailShell onClick={onPress} label="Gift box" glow={ready} disabled={claiming}>
      {status.remainingToday > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#ff2d6a] px-1 text-[12px] font-bold text-white ring-2 ring-black/70">
          {status.remainingToday}
        </span>
      )}
      {claiming ? (
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      ) : (
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            ready && "animate-bounce",
          )}
          style={{ background: "linear-gradient(135deg,#c26bff,#7a2fe0)" }}
        >
          <Gift className="h-5 w-5 text-white" strokeWidth={2} />
        </span>
      )}
      <span className={cn("text-[12px] font-semibold tabular-nums", ready ? "text-[#ffd27a]" : "text-white/90")}>
        {exhausted ? "Done" : ready ? "Open" : fmt(remainingMs)}
      </span>
    </RailShell>
  );
}

/** Vector wheel — opens the existing Subha Lucky game. */
export function LuckySpinButton({ onPress }: { onPress: () => void }) {
  return (
    <RailShell onClick={onPress} label="Lucky Spin">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle cx="20" cy="20" r="18" fill="#2b1b4d" stroke="#ffe08a" strokeWidth="2" />
        {["#ff4d8d", "#ffb347", "#4dd6ff", "#7a5cff", "#47e08a", "#ff6b4d"].map((c, i) => {
          const a0 = (i * Math.PI) / 3 - Math.PI / 2;
          const a1 = ((i + 1) * Math.PI) / 3 - Math.PI / 2;
          const p = (a: number) => `${20 + 16 * Math.cos(a)} ${20 + 16 * Math.sin(a)}`;
          return <path key={c} d={`M20 20 L${p(a0)} A16 16 0 0 1 ${p(a1)} Z`} fill={c} />;
        })}
        <circle cx="20" cy="20" r="3.5" fill="#fff" stroke="#ffe08a" strokeWidth="1.5" />
      </svg>
      <span className="text-[10.5px] font-semibold leading-tight text-white/90">Lucky Spin</span>
    </RailShell>
  );
}

/** Treasure chest with fulfilled/total wishes. Dot = wishes still open. */
export function WishBoxButton({
  fulfilled,
  total,
  onPress,
}: {
  fulfilled: number;
  total: number;
  onPress: () => void;
}) {
  const open = total > 0 && fulfilled < total;
  return (
    <RailShell onClick={onPress} label="Wish Box">
      {open && <Dot />}
      <svg viewBox="0 0 40 36" className="h-8 w-9" aria-hidden>
        <rect x="3" y="14" width="34" height="19" rx="3" fill="#e0883a" stroke="#ffe08a" strokeWidth="1.5" />
        <path d="M3 17 C3 7 37 7 37 17 Z" fill="#f2a64d" stroke="#ffe08a" strokeWidth="1.5" />
        <rect x="17" y="15" width="6" height="9" rx="1.5" fill="#ffe08a" />
        <circle cx="20" cy="19" r="1.4" fill="#7a3d10" />
        <path d="M20 3 l1.6 3.4 3.7.4-2.8 2.5.8 3.7L20 11l-3.3 2 .8-3.7-2.8-2.5 3.7-.4z" fill="#ffe08a" />
      </svg>
      <span className="text-[10.5px] font-semibold leading-tight text-white/90">Wish Box</span>
      <span className="text-[10.5px] font-medium leading-tight tabular-nums text-white/70">
        {fulfilled}/{total}
      </span>
    </RailShell>
  );
}
