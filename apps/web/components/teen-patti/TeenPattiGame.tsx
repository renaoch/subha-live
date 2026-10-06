"use client";

// Solo Teen Patti: you vs four simulated opponents. All state is local — no
// network, no backend. The rules live in lib/teen-patti (pure + tested); this
// file is the table UI and the deal / reveal / result choreography.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Crown, Eye, HelpCircle, RefreshCw, RotateCcw, Settings, Volume2, VolumeX, X } from "lucide-react";
import { PlayingCard } from "./PlayingCard";
import { PortraitAvatar } from "./PortraitAvatar";
import { CATEGORY_LABEL, CATEGORY_ORDER, evaluateHand, HandCategory } from "@/lib/teen-patti/evaluator";
import { createGame, deal, HUMAN, newTable, playAgain, reveal, type GameState } from "@/lib/teen-patti/game";
import { youPortrait } from "@/lib/teen-patti/opponents";
import { defaultRng } from "@/lib/teen-patti/rng";
import { sfx } from "@/lib/teen-patti/sound";
import "./teen-patti.css";

/** Opponent player index (1..4) -> table slot. */
const SLOT_OF = ["you", "l", "tl", "tr", "r"] as const;
/** Deal / reveal order, clockwise from the player's left. */
const DEAL_ORDER = [0, 1, 2, 3, 4];
const REVEAL_ORDER = [1, 2, 3, 4];

const DEAL_STEP_MS = 75;
const DEAL_FLY_MS = 480;
const FLIP_STEP_MS = 260;
const FLIP_MS = 620;

type Busy = null | "dealing" | "revealing";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function TeenPattiGame({ backHref = "/home/party" }: { backHref?: string }) {
  const rngRef = useRef(defaultRng());
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [humanUp, setHumanUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "help" | "settings">(null);
  const [soundOn, setSoundOn] = useState(true);
  const [animPref, setAnimPref] = useState(true);
  const [tally, setTally] = useState({ played: 0, won: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const osReduced = useReducedMotion();
  const animate = animPref && !osReduced;

  // Random profiles are created after mount so server and client markup agree.
  useEffect(() => {
    setGame((g) => g ?? createGame(rngRef.current));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const play = useCallback((fn: () => void) => { if (soundOn) fn(); }, [soundOn]);

  const phase = game?.phase ?? "idle";
  const result = game?.result ?? null;
  const roundKey = game ? `${game.sessionId}-${game.roundNumber}` : "x";

  const humanEval = useMemo(
    () => (game?.hands && phase !== "idle" ? evaluateHand(game.hands[HUMAN]) : null),
    [game?.hands, phase],
  );

  const onDeal = useCallback(() => {
    if (!game || busy || phase !== "idle") return;
    setGame(deal(game, rngRef.current));
    setSettled(false);
    setResultOpen(false);
    setHumanUp(false);
    if (!animate) {
      setHumanUp(true);
      return;
    }
    setBusy("dealing");
    play(() => sfx.deal());
    const flyEnd = 14 * DEAL_STEP_MS + DEAL_FLY_MS;
    later(() => { setHumanUp(true); play(() => sfx.flip()); }, flyEnd + 80);
    later(() => setBusy(null), flyEnd + 80 + FLIP_MS);
  }, [game, busy, phase, animate, later, play]);

  const onReveal = useCallback(() => {
    if (!game || busy || phase !== "dealt") return;
    const next = reveal(game);
    setGame(next);
    const r = next.result!;
    const finish = () => {
      setSettled(true);
      setResultOpen(true);
      setTally((t) => ({ played: t.played + 1, won: t.won + (r.humanWon ? 1 : 0) }));
      play(() => (r.humanWon ? sfx.win() : sfx.lose()));
    };
    if (!animate) {
      finish();
      return;
    }
    setBusy("revealing");
    play(() => sfx.reveal());
    const flipsEnd = (REVEAL_ORDER.length - 1) * FLIP_STEP_MS + FLIP_MS + 2 * 70;
    later(finish, flipsEnd + 120);
    later(() => setBusy(null), flipsEnd + 160);
  }, [game, busy, phase, animate, later, play]);

  const onPlayAgain = useCallback(() => {
    if (!game || busy || phase === "idle") return;
    clearTimers();
    setGame(playAgain(game));
    setSettled(false);
    setResultOpen(false);
    setHumanUp(false);
    play(() => sfx.click());
  }, [game, busy, phase, clearTimers, play]);

  const onNewTable = useCallback(() => {
    if (!game) return;
    clearTimers();
    setBusy(null);
    setGame(newTable(game, rngRef.current));
    setSettled(false);
    setResultOpen(false);
    setHumanUp(false);
    setTally({ played: 0, won: 0 });
    setDialog(null);
  }, [game, clearTimers]);

  // Keyboard: D deal, R reveal, P play again, Esc closes dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (dialog) setDialog(null);
        else setResultOpen(false);
        return;
      }
      if (dialog || resultOpen) return;
      const k = e.key.toLowerCase();
      if (k === "d") onDeal();
      else if (k === "r") onReveal();
      else if (k === "p") onPlayAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, resultOpen, onDeal, onReveal, onPlayAgain]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: 8 + Math.random() * 84,
        delay: Math.random() * 1.6,
        dur: 2.6 + Math.random() * 1.6,
        size: 3 + Math.random() * 4,
        key: `${roundKey}-${i}`,
      })),
    [roundKey],
  );

  if (!game) {
    return <div className="tp-root tp-loading" aria-busy="true"><div className="tp-spinner" /></div>;
  }

  const winners = result?.winners ?? [];
  const isRevealed = phase === "revealed";
  const dealt = phase !== "idle";

  const seatProps = (p: number) => ({
    p,
    slot: SLOT_OF[p],
    dealt,
    roundKey,
    animate,
    dealIndex: DEAL_ORDER.indexOf(p),
    revealIndex: REVEAL_ORDER.indexOf(p),
    cards: game.hands?.[p] ?? null,
    isWinner: settled && winners.includes(p),
    isLoser: settled && !winners.includes(p),
    evalName: result?.evals[p]?.name ?? null,
    revealed: isRevealed,
  });

  const canDeal = phase === "idle" && !busy;
  const canReveal = phase === "dealt" && !busy;
  const canAgain = phase !== "idle" && !busy;
  const status = busy === "dealing" ? "Dealing…" : busy === "revealing" ? "Revealing…" : null;

  return (
    <div className="tp-root" data-motion={animate ? "on" : "off"} data-phase={phase}>
      <div className="tp-backdrop" aria-hidden>
        <i className="tp-bokeh b1" /><i className="tp-bokeh b2" /><i className="tp-bokeh b3" /><i className="tp-bokeh b4" />
        <i className="tp-curtain left" /><i className="tp-curtain right" />
        <i className="tp-lamp l1" /><i className="tp-lamp l2" />
      </div>

      <div className="tp-stage">
        {/* ---------- top bar ---------- */}
        <header className="tp-top">
          <Link href={backHref} className="tp-icon-btn tp-back" aria-label="Back to Party">
            <ArrowLeft />
          </Link>
          <div className="tp-brand">
            <svg viewBox="0 0 100 100" className="tp-brand-spade" aria-hidden><path fill="currentColor" d="M50 4C50 4 12 34 12 58c0 15 12 24 25 19-2 9-6 15-12 18h50c-6-3-10-9-12-18 13 5 25-4 25-19C88 34 50 4 50 4z" /></svg>
            <div>
              <h1 className="tp-title">Teen Patti</h1>
              <p className="tp-sub"><Crown aria-hidden /> SOLO PRACTICE</p>
            </div>
          </div>

          <div className="tp-round" aria-live="polite">
            <div className="tp-round-row">
              <span className="tp-round-n">Round {game.roundNumber}</span>
              <span className="tp-pill">SOLO PRACTICE</span>
            </div>
            <p className="tp-round-sub">{status ?? "You vs 4 Players"}</p>
          </div>

          <div className="tp-controls">
            <button type="button" className="tp-icon-btn" aria-label={soundOn ? "Mute sound" : "Unmute sound"} aria-pressed={!soundOn} onClick={() => setSoundOn((v) => !v)}>
              {soundOn ? <Volume2 /> : <VolumeX />}
            </button>
            <button type="button" className="tp-icon-btn" aria-label="How to play" onClick={() => setDialog("help")}>
              <HelpCircle />
            </button>
            <button type="button" className="tp-icon-btn" aria-label="Settings" onClick={() => setDialog("settings")}>
              <Settings />
            </button>
          </div>
        </header>

        {/* ---------- table ---------- */}
        <div className="tp-table" aria-hidden>
          <div className="tp-felt">
            <div className="tp-logo">
              <svg viewBox="0 0 40 24" className="tp-logo-crown" aria-hidden><path fill="currentColor" d="M3 20 1 6l9 7 10-11 10 11 9-7-2 14z" /><rect x="3" y="21" width="34" height="3" rx="1.2" fill="currentColor" /></svg>
              <span className="tp-logo-text">TEEN PATTI</span>
              <span className="tp-logo-suits"><i>♠</i><i className="r">♥</i><i className="r">♦</i><i>♣</i></span>
            </div>
          </div>
          {!dealt && <div className="tp-deck" />}
        </div>
        <div className="tp-you-pad" aria-hidden />

        {/* ---------- seats ---------- */}
        {game.profiles.map((profile, i) => (
          <Seat key={profile.id} {...seatProps(i + 1)} name={profile.name} portrait={profile.portrait} faceUp={isRevealed} />
        ))}
        <Seat
          {...seatProps(HUMAN)}
          name="You"
          portrait={youPortrait()}
          faceUp={humanUp}
          handLabel={humanEval ? (isRevealed || humanUp ? humanEval.name : null) : null}
        />

        {/* ---------- side panels ---------- */}
        <aside className="tp-panel tp-ranking" aria-label="Hand ranking">
          <h2><Crown aria-hidden /> Hand Ranking</h2>
          <ol>
            {CATEGORY_ORDER.map((cat, i) => (
              <li key={cat} className={humanEval?.category === cat ? "is-mine" : ""}>
                <b>{i + 1}</b>
                {CATEGORY_LABEL[cat]}
              </li>
            ))}
          </ol>
        </aside>

        <aside className="tp-panel tp-info" aria-label="About this game">
          <div className="tp-info-cards" aria-hidden>
            <PlayingCard card={{ rank: 14, suit: "S" }} faceUp />
            <PlayingCard card={{ rank: 13, suit: "S" }} faceUp />
          </div>
          <svg viewBox="0 0 100 100" className="tp-info-spade" aria-hidden><path fill="currentColor" d="M50 4C50 4 12 34 12 58c0 15 12 24 25 19-2 9-6 15-12 18h50c-6-3-10-9-12-18 13 5 25-4 25-19C88 34 50 4 50 4z" /></svg>
          <h2>Draw 3 Cards<br />See Who Wins</h2>
          <p>One player vs 4 players<br />Practice table, play at your pace<br />No real money involved</p>
        </aside>

        {/* compact ranking for narrow/portrait screens */}
        <div className="tp-rank-strip" aria-label="Hand ranking">
          {CATEGORY_ORDER.map((cat, i) => (
            <span key={cat} className={humanEval?.category === cat ? "is-mine" : ""}>
              <b>{i + 1}</b>{cat === HandCategory.Trail ? "Trail" : cat === HandCategory.PureSequence ? "Pure Seq" : cat === HandCategory.Sequence ? "Sequence" : cat === HandCategory.Color ? "Color" : cat === HandCategory.Pair ? "Pair" : "High Card"}
            </span>
          ))}
        </div>

        {/* ---------- actions ---------- */}
        <div className="tp-actions" role="group" aria-label="Game controls">
          <button type="button" className="tp-btn tp-btn-dark" onClick={onDeal} disabled={!canDeal} aria-keyshortcuts="D">
            <RefreshCw aria-hidden /> Deal Cards
          </button>
          <button type="button" className="tp-btn tp-btn-gold" onClick={onReveal} disabled={!canReveal} aria-keyshortcuts="R">
            <Eye aria-hidden /> Reveal Cards
          </button>
          <button type="button" className="tp-btn tp-btn-dark" onClick={onPlayAgain} disabled={!canAgain} aria-keyshortcuts="P">
            <RotateCcw aria-hidden /> Play Again
          </button>
        </div>

        {settled && !resultOpen && (
          <button type="button" className="tp-result-chip" onClick={() => setResultOpen(true)}>
            {result?.isTie ? "Tie" : result?.humanWon ? "You won" : "See result"} · view
          </button>
        )}

        {settled && winners.length > 0 && (
          <div className="tp-sparks" aria-hidden>
            {sparks.map((s) => (
              <i key={s.key} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, width: s.size, height: s.size }} />
            ))}
          </div>
        )}
      </div>

      {/* ---------- result ---------- */}
      {resultOpen && result && game.hands && (
        <ResultDialog
          game={game}
          tally={tally}
          onAgain={onPlayAgain}
          onClose={() => setResultOpen(false)}
        />
      )}

      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === "settings" && (
        <SettingsDialog
          onClose={() => setDialog(null)}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          animPref={animPref}
          setAnimPref={setAnimPref}
          osReduced={osReduced}
          onNewTable={onNewTable}
          disabled={!!busy}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SeatProps {
  p: number;
  slot: (typeof SLOT_OF)[number];
  name: string;
  portrait: ReturnType<typeof youPortrait>;
  cards: import("@/lib/teen-patti/cards").Card[] | null;
  dealt: boolean;
  faceUp: boolean;
  revealed: boolean;
  animate: boolean;
  roundKey: string;
  dealIndex: number;
  revealIndex: number;
  isWinner: boolean;
  isLoser: boolean;
  evalName: string | null;
  handLabel?: string | null;
}

function Seat({ p, slot, name, portrait, cards, dealt, faceUp, revealed, animate, roundKey, dealIndex, revealIndex, isWinner, isLoser, evalName, handLabel }: SeatProps) {
  const isYou = p === HUMAN;
  const label = isYou ? handLabel : revealed ? evalName : null;
  return (
    <section
      className={`tp-seat tp-seat-${slot} ${isWinner ? "is-winner" : ""} ${isLoser ? "is-loser" : ""}`}
      aria-label={isYou ? "Your seat" : `${name}'s seat`}
    >
      <div className="tp-avatar-wrap">
        <div className="tp-avatar">
          <PortraitAvatar spec={portrait} title={isYou ? "You" : name} />
        </div>
        {isWinner && <span className="tp-crown" aria-label="Winner"><Crown /></span>}
      </div>
      <div className="tp-plate"><span>{name}</span></div>

      <div className={`tp-hand ${isYou ? "is-you" : ""}`} key={roundKey}>
        {dealt &&
          [0, 1, 2].map((k) => {
            const order = k * 5 + dealIndex;
            const style = {
              "--k": k,
              "--deal-delay": `${order * DEAL_STEP_MS}ms`,
              "--flip-delay": `${isYou ? k * 70 : revealIndex * FLIP_STEP_MS + k * 70}ms`,
            } as CSSProperties;
            return (
              <PlayingCard
                key={k}
                card={cards?.[k]}
                faceUp={faceUp}
                glow={isWinner}
                className={`tp-hand-card ${animate ? "is-dealing" : ""}`}
                style={style}
              />
            );
          })}
      </div>
      {label && <div className={`tp-hand-label ${isWinner ? "is-win" : ""}`}>{label}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, [href]")?.focus();
    return () => prev?.focus?.();
  }, []);
  // Keep Tab inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return { ref, onKeyDown, onBackdrop: (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); } };
}

function ResultDialog({ game, tally, onAgain, onClose }: { game: GameState; tally: { played: number; won: number }; onAgain: () => void; onClose: () => void }) {
  const { ref, onKeyDown, onBackdrop } = useDialogFocus(onClose);
  const r = game.result!;
  const hands = game.hands!;
  const nameOf = (p: number) => (p === HUMAN ? "You" : game.profiles[p - 1].name);
  const portraitOf = (p: number) => (p === HUMAN ? youPortrait() : game.profiles[p - 1].portrait);
  const lead = r.winners[0];
  const title = r.isTie
    ? "It's a tie!"
    : r.humanWon
      ? "You win!"
      : `${nameOf(lead)} wins`;

  return (
    <div className="tp-modal-back" onMouseDown={onBackdrop}>
      <div className="tp-modal tp-result" role="dialog" aria-modal="true" aria-labelledby="tp-result-title" ref={ref} onKeyDown={onKeyDown}>
        <button type="button" className="tp-modal-x" onClick={onClose} aria-label="Close result"><X /></button>
        <p className={`tp-result-kicker ${r.humanWon ? "is-win" : ""}`}>{r.humanWon ? "Congratulations" : r.isTie ? "Shared pot" : "Round result"}</p>
        <h2 id="tp-result-title" className="tp-result-title">{title}</h2>

        <div className="tp-result-hero">
          {r.winners.slice(0, 2).map((w) => (
            <div key={w} className="tp-result-winner">
              <div className="tp-result-cards">
                {r.evals[w].cards.map((c, i) => (
                  <PlayingCard key={i} card={c} faceUp glow className="tp-mini" style={{ "--k": i } as CSSProperties} />
                ))}
              </div>
              <p className="tp-result-hand">{r.evals[w].name}</p>
              <p className="tp-result-who">{CATEGORY_LABEL[r.evals[w].category]}{r.winners.length > 1 ? ` · ${nameOf(w)}` : ""}</p>
            </div>
          ))}
        </div>
        <p className="tp-result-why">{r.explanation}</p>

        <ol className="tp-standings">
          {r.standings.map((p, idx) => (
            <li key={p} className={`${r.winners.includes(p) ? "is-win" : ""} ${p === HUMAN ? "is-me" : ""}`}>
              <span className="tp-st-rank">{idx + 1}</span>
              <span className="tp-st-av"><PortraitAvatar spec={portraitOf(p)} /></span>
              <span className="tp-st-name">{nameOf(p)}</span>
              <span className="tp-st-hand">
                <span className="tp-st-cards">{hands[p].map((c) => `${["", "", "2","3","4","5","6","7","8","9","10","J","Q","K","A"][c.rank]}${"♠♥♦♣"["SHDC".indexOf(c.suit)]}`).join(" ")}</span>
                {r.evals[p].name}
              </span>
              {r.winners.includes(p) && <Crown className="tp-st-crown" aria-label="Winner" />}
            </li>
          ))}
        </ol>

        <p className="tp-tally">Session: {tally.won} {tally.won === 1 ? "win" : "wins"} in {tally.played} {tally.played === 1 ? "round" : "rounds"}</p>
        <div className="tp-modal-actions">
          <button type="button" className="tp-btn tp-btn-dark" onClick={onClose}>View Table</button>
          <button type="button" className="tp-btn tp-btn-gold" onClick={onAgain}><RotateCcw aria-hidden /> Play Again</button>
        </div>
      </div>
    </div>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const { ref, onKeyDown, onBackdrop } = useDialogFocus(onClose);
  return (
    <div className="tp-modal-back" onMouseDown={onBackdrop}>
      <div className="tp-modal" role="dialog" aria-modal="true" aria-labelledby="tp-help-title" ref={ref} onKeyDown={onKeyDown}>
        <button type="button" className="tp-modal-x" onClick={onClose} aria-label="Close help"><X /></button>
        <h2 id="tp-help-title" className="tp-modal-title">How to play</h2>
        <ol className="tp-howto">
          <li><b>Deal Cards</b> — every player gets three cards. Yours turn face-up; the others stay hidden.</li>
          <li><b>Reveal Cards</b> — all hands are shown and the best hand wins.</li>
          <li><b>Play Again</b> — clears the table for a fresh shuffle. Same opponents, new cards.</li>
        </ol>
        <h3 className="tp-modal-h3">Hand ranking (best → worst)</h3>
        <ol className="tp-howto tp-howto-rank">
          <li><b>Trail</b> — three of a kind. AAA is highest.</li>
          <li><b>Pure Sequence</b> — three consecutive cards of one suit.</li>
          <li><b>Sequence</b> — three consecutive cards, mixed suits.</li>
          <li><b>Color</b> — three cards of one suit, not in sequence.</li>
          <li><b>Pair</b> — two cards of the same rank.</li>
          <li><b>High Card</b> — none of the above.</li>
        </ol>
        <p className="tp-note">Sequences rank A-K-Q (highest), A-2-3, K-Q-J … down to 4-3-2. K-A-2 doesn&apos;t wrap. Suits never break a tie; equal hands share the win.</p>
        <p className="tp-note">Keyboard: <kbd>D</kbd> deal · <kbd>R</kbd> reveal · <kbd>P</kbd> play again.</p>
        <p className="tp-note">This is a solo practice table with simulated opponents. No real money is involved.</p>
        <div className="tp-modal-actions"><button type="button" className="tp-btn tp-btn-gold" onClick={onClose}>Got it</button></div>
      </div>
    </div>
  );
}

function SettingsDialog({ onClose, soundOn, setSoundOn, animPref, setAnimPref, osReduced, onNewTable, disabled }: {
  onClose: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  animPref: boolean;
  setAnimPref: (v: boolean) => void;
  osReduced: boolean;
  onNewTable: () => void;
  disabled: boolean;
}) {
  const { ref, onKeyDown, onBackdrop } = useDialogFocus(onClose);
  return (
    <div className="tp-modal-back" onMouseDown={onBackdrop}>
      <div className="tp-modal" role="dialog" aria-modal="true" aria-labelledby="tp-set-title" ref={ref} onKeyDown={onKeyDown}>
        <button type="button" className="tp-modal-x" onClick={onClose} aria-label="Close settings"><X /></button>
        <h2 id="tp-set-title" className="tp-modal-title">Settings</h2>
        <label className="tp-toggle">
          <span>Sound effects</span>
          <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
          <i aria-hidden />
        </label>
        <label className="tp-toggle">
          <span>Animations{osReduced && <small> · off (device reduced-motion setting)</small>}</span>
          <input type="checkbox" checked={animPref && !osReduced} disabled={osReduced} onChange={(e) => setAnimPref(e.target.checked)} />
          <i aria-hidden />
        </label>
        <button type="button" className="tp-btn tp-btn-dark tp-wide" onClick={onNewTable} disabled={disabled}>
          <RefreshCw aria-hidden /> New table (new opponents)
        </button>
        <div className="tp-modal-actions"><button type="button" className="tp-btn tp-btn-gold" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}