// components/games/LuckySymbol.tsx
//
// Original, data-driven vector artwork for the nine Subha Lucky symbols.
// Each symbol is an inline SVG illustration (no emoji, no external assets),
// keyed by the server-provided symbol id. `size` controls the rendered box;
// the artwork scales to fill it.

import type { LuckySymbolId } from "@/lib/api/lucky";

interface LuckySymbolProps {
  id: LuckySymbolId;
  className?: string;
  size?: number;
}

function Svg({
  size,
  className,
  children,
  viewBox = "0 0 64 64",
}: {
  size: number;
  className?: string;
  children: React.ReactNode;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

function Orange() {
  return (
    <>
      <defs>
        <radialGradient id="sl-orange" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFC24B" />
          <stop offset="55%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#E05A00" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="22" fill="url(#sl-orange)" />
      <circle cx="24" cy="26" r="8" fill="#fff" opacity="0.28" />
      <path d="M32 12c-1 4-6 5-6 9 0 2 1.5 3 3 3" fill="none" stroke="#3E9B4F" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="12" rx="6" ry="3" fill="#2F7A3C" />
    </>
  );
}

function Lemon() {
  return (
    <>
      <defs>
        <linearGradient id="sl-lemon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF36B" />
          <stop offset="100%" stopColor="#FFD400" />
        </linearGradient>
      </defs>
      <path d="M32 14c-11 0-19 9-19 20s8 18 19 18 19-8 19-18-8-20-19-20z" fill="url(#sl-lemon)" />
      <circle cx="22" cy="24" r="6" fill="#fff" opacity="0.4" />
      <path d="M32 48c-1 4-6 5-6 9" fill="none" stroke="#3E9B4F" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Grapes() {
  return (
    <>
      <defs>
        <radialGradient id="sl-grape" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#B07CFF" />
          <stop offset="100%" stopColor="#6A2BD8" />
        </radialGradient>
      </defs>
      {[
        [20, 20], [32, 16], [44, 20],
        [18, 32], [30, 28], [42, 32], [36, 40],
        [24, 40], [30, 48], [38, 48],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={6} fill="url(#sl-grape)" />
      ))}
      <circle cx={20} cy={20} r={2.5} fill="#fff" opacity="0.4" />
      <path d="M32 12c0-3-1-5-4-5-1 1-1 3 1 5" fill="none" stroke="#3E9B4F" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Cherry() {
  return (
    <>
      <defs>
        <radialGradient id="sl-cherry" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FF5D73" />
          <stop offset="100%" stopColor="#C4001E" />
        </radialGradient>
      </defs>
      <circle cx="26" cy="40" r="15" fill="url(#sl-cherry)" />
      <circle cx="42" cy="44" r="14" fill="url(#sl-cherry)" />
      <circle cx="20" cy="34" r="5" fill="#fff" opacity="0.35" />
      <path d="M26 25c-6 0-10 4-12 10M42 30c5 0 8 4 9 10" fill="none" stroke="#3E9B4F" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 24c1-6 6-8 8-14" fill="none" stroke="#3E9B4F" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Apple() {
  return (
    <>
      <defs>
        <radialGradient id="sl-apple" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="100%" stopColor="#D21034" />
        </radialGradient>
      </defs>
      <path d="M32 20c-9-8-22-3-22 12 0 10 9 17 22 17s22-7 22-17c0-15-13-20-22-12z" fill="url(#sl-apple)" />
      <circle cx="22" cy="28" r="6" fill="#fff" opacity="0.3" />
      <path d="M32 20c-2-5-1-9 2-12" fill="none" stroke="#5A3A1E" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 14c2-3 6-3 7-6-3 0-6 1-7 4z" fill="#3E9B4F" />
    </>
  );
}

function Watermelon() {
  return (
    <>
      <defs>
        <radialGradient id="sl-melon-f" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#FF5D73" />
          <stop offset="100%" stopColor="#F21B3F" />
        </radialGradient>
      </defs>
      <path d="M32 44a24 24 0 0 1-24-24c0-3 2-5 5-5h38c3 0 5 2 5 5a24 24 0 0 1-24 24z" fill="#2F9B4B" />
      <path d="M32 40a20 20 0 0 1-20-20c0-2 1.6-3 3.6-3h32.8c2 0 3.6 1 3.6 3a20 20 0 0 1-20 20z" fill="url(#sl-melon-f)" />
      {[
        [22, 26], [30, 22], [40, 26], [28, 32], [38, 33],
      ].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="2" ry="3" fill="#1A0E0E" transform={`rotate(${i * 30} ${cx} ${cy})`} />
      ))}
    </>
  );
}

function Mango() {
  return (
    <>
      <defs>
        <linearGradient id="sl-mango" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD45E" />
          <stop offset="60%" stopColor="#FF9E1B" />
          <stop offset="100%" stopColor="#F5710B" />
        </linearGradient>
      </defs>
      <path d="M30 14c-14 4-20 22-8 34 6 6 18 6 24-2 7-9 5-28-8-32z" fill="url(#sl-mango)" />
      <circle cx="24" cy="26" r="6" fill="#fff" opacity="0.3" />
      <path d="M38 18c4-4 9-5 12-4" fill="none" stroke="#2F9B4B" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Strawberry() {
  return (
    <>
      <defs>
        <radialGradient id="sl-berry" cx="40%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FF6B81" />
          <stop offset="100%" stopColor="#D4042C" />
        </radialGradient>
      </defs>
      <path d="M32 20c-12-2-18 8-16 20 2 11 11 16 16 16s14-5 16-16c2-12-4-22-16-20z" fill="url(#sl-berry)" />
      {[
        [22, 30], [30, 26], [40, 30], [28, 38], [38, 40], [32, 48],
      ].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="1.6" ry="2.4" fill="#FFE9A8" opacity="0.9" />
      ))}
      <path d="M32 18c0-6-1-9-4-11 0 0 1 5-2 9 0 0 4 1 6 2z" fill="#2F9B4B" />
    </>
  );
}

function Lucky() {
  return (
    <>
      <defs>
        <linearGradient id="sl-lucky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="50%" stopColor="#FFC24B" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="34" r="24" fill="url(#sl-lucky)" />
      <circle cx="32" cy="34" r="19" fill="#5A3A1E" opacity="0.18" />
      <path d="M32 18l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L32 41.5 22.7 46.5l1.8-10.3-7.5-7.3 10.4-1.5z" fill="#FFF8E1" />
      <circle cx="32" cy="30" r="3" fill="#5A3A1E" opacity="0.25" />
    </>
  );
}

const RENDERERS: Record<LuckySymbolId, () => React.ReactElement> = {
  orange: Orange,
  lemon: Lemon,
  grapes: Grapes,
  cherry: Cherry,
  apple: Apple,
  watermelon: Watermelon,
  mango: Mango,
  strawberry: Strawberry,
  lucky: Lucky,
};

export function LuckySymbol({ id, className, size = 48 }: LuckySymbolProps) {
  const Render = RENDERERS[id];
  return (
    <Svg size={size} className={className}>
      {Render ? <Render /> : <circle cx="32" cy="32" r="20" fill="#333" />}
    </Svg>
  );
}
