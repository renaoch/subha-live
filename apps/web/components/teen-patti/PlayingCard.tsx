// Playing card with a real 3D flip. Front: rank/suit corners, pip layouts for
// 2-10, large ace, ornate court panels for J/Q/K. Back: navy + gold lattice.
// Sized entirely from the parent via the --cw CSS variable.

import type { CSSProperties } from "react";
import { cardName, isRed, rankLabel, type Card, type Suit } from "@/lib/teen-patti/cards";

const SUIT_PATH: Record<Suit, React.ReactNode> = {
  S: <path d="M50 4C50 4 12 34 12 58c0 15 12 24 25 19-2 9-6 15-12 18h50c-6-3-10-9-12-18 13 5 25-4 25-19C88 34 50 4 50 4z" />,
  H: <path d="M50 94S6 64 6 34C6 18 18 8 31 8c9 0 16 5 19 13 3-8 10-13 19-13 13 0 25 10 25 26 0 30-44 60-44 60z" />,
  D: <path d="M50 2 90 50 50 98 10 50z" />,
  C: (
    <>
      <circle cx="50" cy="29" r="21" />
      <circle cx="26" cy="63" r="21" />
      <circle cx="74" cy="63" r="21" />
      <path d="M43 56 36 96h28l-7-40z" />
    </>
  ),
};

export function SuitIcon({ suit, className, style }: { suit: Suit; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} fill="currentColor" aria-hidden>
      {SUIT_PATH[suit]}
    </svg>
  );
}

// Pip centres as [x%, y%] inside the pip field.
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 16], [50, 84]],
  3: [[50, 16], [50, 50], [50, 84]],
  4: [[30, 16], [70, 16], [30, 84], [70, 84]],
  5: [[30, 16], [70, 16], [50, 50], [30, 84], [70, 84]],
  6: [[30, 16], [70, 16], [30, 50], [70, 50], [30, 84], [70, 84]],
  7: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [30, 84], [70, 84]],
  8: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [50, 67], [30, 84], [70, 84]],
  9: [[30, 12], [70, 12], [30, 37], [70, 37], [50, 50], [30, 63], [70, 63], [30, 88], [70, 88]],
  10: [[30, 12], [70, 12], [50, 25], [30, 37], [70, 37], [30, 63], [70, 63], [50, 75], [30, 88], [70, 88]],
};

function Court({ rank, red }: { rank: 11 | 12 | 13; red: boolean }) {
  const robe = red ? ["#B3202E", "#6E0F1A"] : ["#243B7A", "#101C45"];
  const id = `c${rank}${red ? "r" : "b"}`;
  const Half = (
    <g>
      {/* robe */}
      <path d="M6 40 Q8 27 30 25 Q52 27 54 40 Z" fill={`url(#${id}-robe)`} stroke="#C99A3C" strokeWidth="0.8" />
      <path d="M22 26 L30 40 L38 26" fill="#F4E3B4" stroke="#C99A3C" strokeWidth="0.5" />
      <circle cx="30" cy="33" r="1.1" fill="#C99A3C" />
      {/* neck + face */}
      <rect x="27.5" y="21" width="5" height="5" fill="#E7B98E" />
      <ellipse cx="30" cy="16.5" rx="5.2" ry="6.4" fill="#F2CBA2" stroke="#B47F4F" strokeWidth="0.4" />
      <circle cx="28" cy="16" r="0.55" fill="#2b1a10" />
      <circle cx="32" cy="16" r="0.55" fill="#2b1a10" />
      <path d="M28.4 19.6 Q30 20.8 31.6 19.6" stroke="#9a4b3a" strokeWidth="0.55" fill="none" strokeLinecap="round" />
      {rank === 13 && <path d="M25.2 18 Q30 28 34.8 18 Q34 22.5 30 23.8 Q26 22.5 25.2 18Z" fill="#E9E3D6" opacity="0.95" />}
      {rank === 12 && <path d="M24.6 15 Q22 24 26 28 M35.4 15 Q38 24 34 28" stroke="#6B4426" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {rank === 11 && <path d="M24.6 15 Q25 9 30 9.6 Q35 9 35.4 15 Q32 11.5 30 12 Q28 11.5 24.6 15Z" fill="#4A2C18" />}
      {/* headwear */}
      {rank === 13 && (
        <>
          <path d="M23.5 11.5 L24.6 3.6 L27.4 8 L30 2.2 L32.6 8 L35.4 3.6 L36.5 11.5 Z" fill="#F0C65A" stroke="#A8761F" strokeWidth="0.55" />
          <circle cx="30" cy="3" r="1" fill="#D8283B" />
          <rect x="23.4" y="10.6" width="13.2" height="1.8" rx="0.6" fill="#D4A23E" stroke="#A8761F" strokeWidth="0.4" />
        </>
      )}
      {rank === 12 && (
        <>
          <path d="M24 11 Q30 1.5 36 11 Z" fill="#F0C65A" stroke="#A8761F" strokeWidth="0.55" />
          <circle cx="30" cy="5.2" r="1.15" fill="#3B7BD9" />
          <circle cx="26.6" cy="8" r="0.8" fill="#D8283B" />
          <circle cx="33.4" cy="8" r="0.8" fill="#D8283B" />
        </>
      )}
      {rank === 11 && (
        <>
          <path d="M23.8 11 Q30 4 36.2 11 Q30 8.6 23.8 11Z" fill={robe[0]} stroke="#C99A3C" strokeWidth="0.5" />
          <path d="M35.5 9 Q42 2 44 6 Q40 5 37 10" fill="#F4F1EA" stroke="#B9B2A0" strokeWidth="0.35" />
        </>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 60 80" className="tp-court-svg" aria-hidden>
      <defs>
        <linearGradient id={`${id}-robe`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={robe[0]} />
          <stop offset="100%" stopColor={robe[1]} />
        </linearGradient>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF1D2" />
          <stop offset="100%" stopColor="#EBD59B" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="58" height="78" rx="4" fill={`url(#${id}-bg)`} stroke="#C99A3C" strokeWidth="1.1" />
      <rect x="4" y="4" width="52" height="72" rx="2.5" fill="none" stroke="#C99A3C" strokeWidth="0.45" opacity="0.75" />
      <line x1="4" y1="40" x2="56" y2="40" stroke="#C99A3C" strokeWidth="0.45" opacity="0.7" />
      <g transform="translate(0 0)">{Half}</g>
      <g transform="translate(60 80) rotate(180)">{Half}</g>
    </svg>
  );
}

interface PlayingCardProps {
  card?: Card;
  faceUp: boolean;
  className?: string;
  style?: CSSProperties;
  /** Visual emphasis for winning cards. */
  glow?: boolean;
}

export function PlayingCard({ card, faceUp, className = "", style, glow }: PlayingCardProps) {
  const red = card ? isRed(card.suit) : false;
  const label = card ? rankLabel(card.rank) : "";
  return (
    <div
      className={`tp-card ${faceUp ? "is-up" : ""} ${glow ? "is-glow" : ""} ${className}`}
      style={style}
      role="img"
      aria-label={faceUp && card ? cardName(card) : "Face-down card"}
    >
      <div className="tp-card-inner">
        <div className={`tp-card-face tp-card-front ${red ? "is-red" : "is-black"}`}>
          {card && (
            <>
              <div className="tp-corner tp-corner-tl">
                <span className="tp-rank">{label}</span>
                <SuitIcon suit={card.suit} className="tp-corner-suit" />
              </div>
              <div className="tp-corner tp-corner-br">
                <span className="tp-rank">{label}</span>
                <SuitIcon suit={card.suit} className="tp-corner-suit" />
              </div>
              <div className="tp-field">
                {card.rank >= 11 && card.rank <= 13 ? (
                  <div className="tp-court">
                    <Court rank={card.rank as 11 | 12 | 13} red={red} />
                    <SuitIcon suit={card.suit} className="tp-court-suit tp-court-suit-a" />
                    <SuitIcon suit={card.suit} className="tp-court-suit tp-court-suit-b" />
                  </div>
                ) : card.rank === 14 ? (
                  <SuitIcon suit={card.suit} className="tp-ace" />
                ) : (
                  PIPS[card.rank].map(([x, y], i) => (
                    <SuitIcon
                      key={i}
                      suit={card.suit}
                      className={`tp-pip ${y > 52 ? "is-flip" : ""}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="tp-card-face tp-card-back" aria-hidden>
          <div className="tp-back-frame">
            <svg viewBox="0 0 50 70" className="tp-back-emblem" aria-hidden>
              <path d="M25 8 40 35 25 62 10 35z" fill="none" stroke="#E8C27A" strokeWidth="1.6" />
              <path d="M25 17 34 35 25 53 16 35z" fill="#E8C27A" opacity="0.2" stroke="#E8C27A" strokeWidth="0.9" />
              <circle cx="25" cy="35" r="4.2" fill="#E8C27A" />
              <path d="M25 31.2l1.1 2.6 2.7.2-2.1 1.8.7 2.7-2.4-1.5-2.4 1.5.7-2.7-2.1-1.8 2.7-.2z" fill="#14245c" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}