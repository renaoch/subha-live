// components/games/SubhaLuckyRingGame.tsx
//
// "Lucky Pro" ring game — a shared room round. Everyone watching bets during
// the BETTING countdown; when it hits 0 the board spins (SPINNING) and lands
// on one cell; everyone who bet on it is paid when it settles (SETTLED),
// then the next BETTING round opens immediately. See useLuckyRing.ts for the
// polling/state-sync details and lucky-ring.service.ts (API) for the
// server-authoritative phase machine.

"use client";

import { useEffect, useState } from "react";
import { X, HelpCircle, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useLuckyRing } from "@/hooks/useLuckyRing";
import { LuckyRingBoard } from "./LuckyRingBoard";
import { LuckySymbol } from "./LuckySymbol";
import { playLuckySpinSound, playLuckyStopSound, playLuckyWinSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

interface SubhaLuckyRingGameProps {
  roomId: string;
  onClose: () => void;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function SubhaLuckyRingGame({ roomId, onClose }: SubhaLuckyRingGameProps) {
  const {
    status,
    roundNumber,
    msLeft,
    winningCell,
    balance,
    todayWinnings,
    myBets,
    recentResults,
    selectedBet,
    setSelectedBet,
    bets,
    cells,
    config,
    placeBet,
    placingCell,
    error,
  } = useLuckyRing(roomId);

  const [soundOn, setSoundOn] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [wonThisRound, setWonThisRound] = useState<number | null>(null);

  // Sound cues on phase changes.
  useEffect(() => {
    if (!soundOn) return;
    if (status === "SPINNING") playLuckySpinSound();
    if (status === "SETTLED") playLuckyStopSound();
  }, [status, soundOn]);

  // Detect a personal win once a round settles (my bet on the winning cell).
  useEffect(() => {
    if (status !== "SETTLED" || winningCell == null) {
      setWonThisRound(null);
      return;
    }
    const myAmount = myBets[winningCell];
    if (myAmount) {
      const cell = cells.find((c) => c.index === winningCell);
      const payout = cell ? myAmount * cell.multiplier : 0;
      setWonThisRound(payout);
      if (soundOn && payout > 0) playLuckyWinSound();
    } else {
      setWonThisRound(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningCell]);

  const secondsLeft = Math.ceil(msLeft / 1000);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#1c0506]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(245,185,63,0.16), transparent 60%), radial-gradient(90% 50% at 100% 100%, rgba(180,20,30,0.25), transparent 60%), linear-gradient(180deg, #2a0709 0%, #150304 100%)",
        }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+12px)]">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? "Mute sound" : "Enable sound"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F5B93F]/30 bg-black/30 text-[#F5B93F]/90 transition hover:bg-black/50 active:scale-95"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <div className="grad-brand rounded-full px-6 py-1 shadow-[0_6px_18px_-4px_rgba(245,120,30,0.7)]">
            <h1 className="text-lg font-black italic tracking-wide text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.3)]">
              lucky pro
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              aria-label="Rules and help"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F5B93F]/30 bg-black/30 text-[#F5B93F]/90 transition hover:bg-black/50 active:scale-95"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close game"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F5B93F]/30 bg-black/30 text-[#F5B93F]/90 transition hover:bg-black/50 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Phase banner: what's happening right now, and how long it lasts */}
        <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-[#F5B93F]/25 bg-black/25 px-4 py-1.5">
          {status === "BETTING" ? (
            <p className="text-xs font-semibold text-white/80">
              Place your bets — <span className="text-[#FFE08A]">{secondsLeft}s</span> left
            </p>
          ) : status === "SPINNING" ? (
            <p className="text-xs font-semibold text-white/80">Spinning…</p>
          ) : wonThisRound ? (
            <p className="text-xs font-bold text-[#FFE08A]">
              You won {formatCompact(wonThisRound)}! 🎉
            </p>
          ) : (
            <p className="text-xs font-semibold text-white/60">No luck this round — next one's starting</p>
          )}
        </div>

        {/* Balance / winnings */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex-1 rounded-2xl border border-[#F5B93F]/25 bg-black/25 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#F5B93F]/60">Balance</p>
            <p className="mt-0.5 text-lg font-bold text-white">{balance === null ? "—" : formatCompact(balance)}</p>
          </div>
          <div className="flex-1 rounded-2xl border border-[#F5B93F]/25 bg-black/25 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#F5B93F]/60">Today&apos;s winnings</p>
            <p className="mt-0.5 text-lg font-bold text-[#F5B93F]">{formatCompact(todayWinnings)}</p>
          </div>
        </div>

        {/* Board */}
        <div className="mt-3">
          <LuckyRingBoard
            cells={cells}
            status={status}
            winningCell={winningCell}
            spinMs={config?.spinMs ?? 4500}
            msLeft={msLeft}
            myBets={myBets}
            placingCell={placingCell}
            onCellTap={placeBet}
            roundNumber={roundNumber}
          />
        </div>

        {/* Bet chip selector — tap an amount, then tap a cell above to place it */}
        <div className="mt-3">
          <p className="mb-1.5 text-center text-[11px] font-medium text-white/50">
            {status === "BETTING" ? "Pick an amount, then tap a cell" : "Betting reopens next round"}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {bets.map((bet) => {
              const active = bet === selectedBet;
              const affordable = balance !== null && balance >= bet;
              return (
                <button
                  key={bet}
                  type="button"
                  onClick={() => setSelectedBet(bet)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border-2 py-2 text-center text-xs font-black transition active:scale-95",
                    active
                      ? "border-[#F5B93F] bg-gradient-to-b from-[#7c4dff] to-[#5a2be0] text-white shadow-[0_0_16px_rgba(124,77,255,0.5)]"
                      : "border-[#F5B93F]/50 bg-gradient-to-b from-[#F5B93F] to-[#c98a1f] text-black hover:brightness-110",
                    !affordable && "opacity-60",
                  )}
                >
                  {formatCompact(bet)}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-center text-xs font-medium text-red-300">{error.message}</p>
        )}

        {/* Results strip */}
        {recentResults.length > 0 && (
          <div className="mt-3 rounded-2xl border border-[#F5B93F]/20 bg-black/20 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#F5B93F]/50">
              Results
            </p>
            <div className="flex gap-1.5 overflow-x-auto">
              {recentResults.map((r) => {
                const cell = cells.find((c) => c.index === r.winningCell);
                if (!cell) return null;
                return (
                  <div
                    key={r.roundId}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#F5B93F]/25 bg-white/5"
                  >
                    <LuckySymbol id={cell.symbol} size={24} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {rulesOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4"
          onClick={() => setRulesOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] rounded-3xl border border-[#F5B93F]/30 bg-[#1c0506] p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#F5B93F]" />
              <h2 className="text-base font-bold text-white">How Lucky Pro works</h2>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              <li>• Everyone in the room bets on the same round at the same time.</li>
              <li>• Pick a bet amount, then tap any cell to place a chip on it before the timer runs out.</li>
              <li>• When betting closes, the board spins and lands on one cell.</li>
              <li>• Anyone who bet on that cell is paid bet × the cell&apos;s multiplier. Everyone else&apos;s bet is spent.</li>
              <li>• This is a virtual-coin game for fun — coins have no cash value.</li>
            </ul>
            <button
              type="button"
              onClick={() => setRulesOpen(false)}
              className="mt-4 w-full rounded-full bg-[#F5B93F] py-2.5 text-sm font-bold text-black"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}