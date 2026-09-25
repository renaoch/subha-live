// components/games/SubhaLuckyGame.tsx
//
// The Subha Lucky game shell. Renders the header, board, bet selector, spin
// button, balance/winnings, recent results and the rules panel. All outcomes
// come from the server via useLucky(); this component only plays them back.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, HelpCircle, Volume2, VolumeX, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import { useLucky } from "@/hooks/useLucky";
import { LuckyBoard } from "@/components/games/LuckyBoard";
import { LuckySymbol } from "@/components/games/LuckySymbol";
import type { LuckyPublicConfig, LuckySpinResult } from "@/lib/api/lucky";
import {
  playLuckySpinSound,
  playLuckyWinSound,
  playLuckyBigWinSound,
  playLuckyJackpotSound,
} from "@/lib/sound";

interface SubhaLuckyGameProps {
  roomId: string;
  onClose: () => void;
}

function isLargeWin(result: LuckySpinResult): boolean {
  return result.payout > 0 && (result.isJackpot || result.payout >= result.bet * 10);
}

export function SubhaLuckyGame({ roomId, onClose }: SubhaLuckyGameProps) {
  const {
    config,
    balance,
    todayWinnings,
    recentResults,
    selectedBet,
    bets,
    setSelectedBet,
    phase,
    result,
    error,
    spin,
    finishReveal,
    reload,
  } = useLucky(roomId);

  const [soundOn, setSoundOn] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);

  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  // Celebrate (with sound) once the reels finish revealing the result.
  const handleRevealed = () => {
    const r = result;
    if (soundOnRef.current && r) {
      if (r.isJackpot) playLuckyJackpotSound();
      else if (r.payout >= r.bet * 10) playLuckyBigWinSound();
      else if (r.payout > 0) playLuckyWinSound();
    }
    finishReveal();
  };

  const handleSpin = () => {
    if (phase === "spinning") return;
    if (soundOnRef.current) playLuckySpinSound();
    void spin();
  };

  const winTier = result && result.payout > 0 ? (isLargeWin(result) ? "large" : "normal") : null;
  const showWin = phase === "revealing" && result && result.payout > 0;

  const insufficientBalance = error?.code === "INSUFFICIENT_BALANCE";

  const recentIcons = useMemo(() => recentResults.slice(0, 6), [recentResults]);

  const disabled = phase !== "idle" || selectedBet == null || !config;

  if (!config) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-white">
          <Sparkles className="h-6 w-6 animate-pulse text-[#F5B93F]" />
          <p className="text-sm text-white/70">Loading Subha Lucky…</p>
          {error && (
            <button
              onClick={() => void reload()}
              className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d0710]">
      {/* Premium backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(168,85,247,0.22), transparent 60%), radial-gradient(90% 50% at 100% 100%, rgba(245,185,63,0.12), transparent 60%), linear-gradient(180deg, #1a0f24 0%, #0d0710 100%)",
        }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {/* Header */}
        <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5B93F]/15 ring-1 ring-[#F5B93F]/30">
              <Sparkles className="h-4 w-4 text-[#F5B93F]" />
            </span>
            <div className="leading-none">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#F5B93F]/80">SUBHA</p>
              <h1 className="grad-gold-text text-xl font-black tracking-tight">Lucky</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-label={soundOn ? "Mute sound" : "Enable sound"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/15 active:scale-95"
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              aria-label="Rules and help"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/15 active:scale-95"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close game"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/15 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">Balance</p>
            <p className="mt-0.5 text-lg font-bold text-white">{balance === null ? "—" : formatCompact(balance)}</p>
          </div>
          <div className="flex-1 rounded-2xl border border-[#F5B93F]/20 bg-[#F5B93F]/[0.06] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#F5B93F]/70">Today&apos;s winnings</p>
            <p className="mt-0.5 text-lg font-bold text-[#F5B93F]">{formatCompact(todayWinnings)}</p>
          </div>
        </div>

        {/* Board */}
        <div className="mt-4">
          <LuckyBoard
            config={config}
            spinning={phase === "spinning"}
            revealing={phase === "revealing"}
            result={result}
            onRevealed={handleRevealed}
          />
        </div>

        {/* Result / status line */}
        <div className="mt-3 flex min-h-[40px] items-center justify-center">
          {showWin && result ? (
            <WinBanner result={result} tier={isLargeWin(result) ? "large" : "normal"} />
          ) : error ? (
            <div className="text-center">
              <p className={cn("text-sm font-semibold", insufficientBalance ? "text-[#FF6B81]" : "text-[#FFC24B]")}>
                {error.message}
              </p>
              {error.retryable && (
                <button
                  onClick={() => void spin()}
                  className="mt-1 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold text-white"
                >
                  Try again
                </button>
              )}
              {insufficientBalance && (
                <a
                  href="/wallet"
                  className="mt-1 inline-block rounded-full bg-[#F5B93F] px-4 py-1 text-xs font-bold text-black"
                >
                  Recharge
                </a>
              )}
            </div>
          ) : phase === "spinning" ? (
            <p className="text-sm font-medium text-white/50">Spinning…</p>
          ) : result && result.payout === 0 ? (
            <p className="text-sm font-medium text-white/60">No luck this time — try again!</p>
          ) : (
            <p className="text-sm font-medium text-white/50">Pick a bet and spin</p>
          )}
        </div>

        {/* Bet selector */}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">Bet amount</p>
          <div className="grid grid-cols-4 gap-2">
            {bets.map((bet) => {
              const active = bet === selectedBet;
              const affordable = balance !== null && balance >= bet;
              return (
                <button
                  key={bet}
                  type="button"
                  disabled={phase === "spinning"}
                  onClick={() => setSelectedBet(bet)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border px-1 py-2.5 text-center text-sm font-bold transition active:scale-95 disabled:opacity-50",
                    active
                      ? "border-[#F5B93F] bg-[#F5B93F]/15 text-[#F5B93F] shadow-[0_0_16px_rgba(245,185,63,0.25)]"
                      : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10",
                    !affordable && "text-white/35",
                  )}
                >
                  {formatCompact(bet)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spin button */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={disabled}
          className={cn(
            "mt-4 w-full rounded-2xl py-4 text-lg font-black tracking-wide text-black transition active:scale-[0.98] disabled:opacity-60",
            "grad-brand shadow-[0_12px_30px_-10px_rgba(245,120,30,0.6)]",
          )}
        >
          {phase === "spinning" ? "Spinning…" : phase === "revealing" ? "…" : "SPIN"}
        </button>

        {/* Recent results */}
        {recentIcons.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">Recent</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recentIcons.map((r) => (
                <div
                  key={r.roundId}
                  className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5"
                >
                  <LuckySymbol id={r.symbols[4] ?? "orange"} size={26} />
                  <span className={cn("text-[10px] font-bold", r.payout > 0 ? "text-[#F5B93F]" : "text-white/50")}>
                    {r.multiplier > 0 ? `${r.multiplier}×` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Win overlay for big wins / jackpot */}
      {showWin && result && winTier === "large" && <JackpotOverlay result={result} />}

      {rulesOpen && <RulesPanel onClose={() => setRulesOpen(false)} config={config} />}
    </div>
  );
}

function WinBanner({ result, tier }: { result: LuckySpinResult; tier: "normal" | "large" }) {
  return (
    <div
      className={cn(
        "animate-pop-in rounded-full px-5 py-1.5 text-center",
        tier === "large"
          ? "bg-[#F5B93F]/20 ring-1 ring-[#F5B93F]/50 shadow-[0_0_24px_rgba(245,185,63,0.35)]"
          : "bg-white/[0.08] ring-1 ring-white/15",
      )}
    >
      <span className={cn("text-sm font-black", tier === "large" ? "text-[#FFE08A]" : "text-white")}>
        +{formatCompact(result.payout)} coins
      </span>
      {result.multiplier > 0 && (
        <span className={cn("ml-2 text-xs font-semibold", tier === "large" ? "text-[#F5B93F]" : "text-white/60")}>
          {result.multiplier}×
        </span>
      )}
    </div>
  );
}

function JackpotOverlay({ result }: { result: LuckySpinResult }) {
  const label = result.isJackpot ? "LUCKY!" : "BIG WIN!";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="lucky-particle absolute h-2 w-2 rounded-full bg-[#F5B93F]"
            style={{
              left: `${(i % 4) * 30 + 5}%`,
              animationDelay: `${i * 120}ms`,
              animationDuration: `${1200 + (i % 3) * 300}ms`,
            }}
          />
        ))}
        <p className="grad-gold-text animate-pop-in text-4xl font-black drop-shadow-[0_0_20px_rgba(245,185,63,0.6)]">
          {label}
        </p>
        <p className="mt-1 animate-pop-in text-xl font-bold text-white">
          +{formatCompact(result.payout)} coins
        </p>
      </div>
      <style jsx>{`
        .lucky-particle {
          animation-name: lucky-particle;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }
        @keyframes lucky-particle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx, 0), -140px) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function RulesPanel({ onClose, config }: { onClose: () => void; config: LuckyPublicConfig }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to play Subha Lucky"
        className="w-full max-w-[430px] rounded-t-[28px] border-t border-white/10 bg-[#141118] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">How to play</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-white/75">
          <p>
            <span className="font-semibold text-white">Subha Lucky</span> is a 3×3 luck game. Spin the reels
            and match three of the same fruit (or Lucky wilds) across a payline to win coins.
          </p>
          <ul className="space-y-2">
            {config.symbols
              .filter((s) => s.id !== "lucky")
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <LuckySymbol id={s.id} size={22} />
                  <span className="flex-1 text-white/70">{s.name}</span>
                  <span className="font-semibold text-[#F5B93F]">{s.multiplier}×</span>
                </li>
              ))}
            <li className="flex items-center gap-2">
              <LuckySymbol id="lucky" size={22} />
              <span className="flex-1 text-white/70">
                Lucky <span className="text-white/45">(wild — substitutes for any fruit)</span>
              </span>
              <span className="font-semibold text-[#F5B93F]">{config.jackpotMultiplier}×</span>
            </li>
          </ul>
          <p>
            Your bet is deducted before each spin. A winning line pays{" "}
            <span className="font-semibold text-white">bet × multiplier</span>; multiple lines stack. Three
            Lucky symbols is the jackpot. Maximum payout per spin is{" "}
            <span className="font-semibold text-white">{formatCompact(config.maxPayout)}</span> coins.
          </p>
          <p className="text-xs text-white/45">
            Subha Lucky is a virtual-coin game for fun. Outcomes are determined by a fair, server-side
            random process and can never be predicted or guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
