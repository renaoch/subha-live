"use client";

// A plush "throne" lounge chair used behind each seated avatar: padded wing
// backrest with tufting + a jewel crest, rolled armrests, glossy cushion and
// gold feet. Pure decorative SVG so it can't affect audio/seat state.
//
// `tone` picks the palette. Hosts are gold; guest seats are coloured by unlock
// tier (violet -> cyan -> rose) so newly opened rows feel special; `locked` is
// a cold steel version used for seats that haven't been unlocked yet.

export type ChairTone = "host" | "violet" | "cyan" | "rose" | "locked" | "guest";

interface Palette {
  light: string;
  mid: string;
  dark: string;
  trim: string;
  /** CSS colour used for glows / accents outside the SVG. */
  glow: string;
}

export const CHAIR_PALETTES: Record<Exclude<ChairTone, "guest">, Palette> = {
  host: { light: "#FFF0B8", mid: "#FFC94A", dark: "#B8741A", trim: "#FFF6D6", glow: "#FFC94A" },
  violet: { light: "#D2BEFF", mid: "#9B72FF", dark: "#5A33C8", trim: "#F0E8FF", glow: "#A27BFF" },
  cyan: { light: "#A8F4FF", mid: "#27D3FF", dark: "#0A86B8", trim: "#DDFBFF", glow: "#27D3FF" },
  rose: { light: "#FFB4D0", mid: "#FF4F93", dark: "#B01C5E", trim: "#FFE0EC", glow: "#FF4F93" },
  locked: { light: "#9A9AB4", mid: "#6A6A85", dark: "#35354A", trim: "#C4C4DA", glow: "#8A8AA8" },
};

export function chairPalette(tone: ChairTone): Palette {
  return CHAIR_PALETTES[tone === "guest" ? "violet" : tone];
}

interface StageChairProps {
  tone?: ChairTone;
  className?: string;
  style?: React.CSSProperties;
}

export function StageChair({ tone = "violet", className, style }: StageChairProps) {
  const t = tone === "guest" ? "violet" : tone;
  const p = CHAIR_PALETTES[t];
  const id = `chair-${t}`;

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden style={{ display: "block", ...style }}>
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.light} />
          <stop offset="45%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.dark} />
        </linearGradient>
        <linearGradient id={`${id}-panel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.mid} stopOpacity="1" />
          <stop offset="100%" stopColor={p.dark} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={p.mid} stopOpacity="0.55" />
          <stop offset="100%" stopColor={p.mid} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="90" rx="38" ry="5" fill={`url(#${id}-floor)`} />

      {/* Feet */}
      <rect x="17" y="82" width="7" height="9" rx="3" fill={p.dark} stroke={p.trim} strokeOpacity="0.55" strokeWidth="0.8" />
      <rect x="72" y="82" width="7" height="9" rx="3" fill={p.dark} stroke={p.trim} strokeOpacity="0.55" strokeWidth="0.8" />

      {/* Wing backrest */}
      <path
        d="M14 11 Q14 2 30 2 L66 2 Q82 2 82 11 L82 52 Q82 66 70 70 L26 70 Q14 66 14 52 Z"
        fill={`url(#${id}-back)`}
        stroke={p.trim}
        strokeOpacity="1"
        strokeWidth="1.8"
      />
      {/* Padded inner panel */}
      <path
        d="M22 13 Q22 9 32 9 L64 9 Q74 9 74 13 L74 50 Q74 62 64 64 L32 64 Q22 62 22 50 Z"
        fill={`url(#${id}-panel)`}
        stroke={p.trim}
        strokeOpacity="0.7"
        strokeWidth="1.1"
      />
      {/* Tufting studs */}
      {[20, 36, 52].map((y) => (
        <g key={y}>
          <circle cx="18" cy={y} r="1.5" fill={p.trim} fillOpacity="0.85" />
          <circle cx="78" cy={y} r="1.5" fill={p.trim} fillOpacity="0.85" />
        </g>
      ))}
      {/* Jewel crest */}
      <path d="M48 0.5 L53.5 6 L48 11.5 L42.5 6 Z" fill={p.trim} stroke={p.mid} strokeWidth="0.8" />
      <path d="M48 2.5 L51 6 L48 9.5 L45 6 Z" fill="#fff" fillOpacity="0.7" />
      {/* Glossy sheen */}
      <path d="M15 12 Q15 4 30 3.5 L42 3.5 Q28 28 26 68 Q15 64 15 52 Z" fill={`url(#${id}-sheen)`} opacity="0.7" />

      {/* Rolled armrests */}
      <rect x="4" y="38" width="13" height="36" rx="6.5" fill={`url(#${id}-back)`} stroke={p.trim} strokeOpacity="0.95" strokeWidth="1.4" />
      <rect x="79" y="38" width="13" height="36" rx="6.5" fill={`url(#${id}-back)`} stroke={p.trim} strokeOpacity="0.95" strokeWidth="1.4" />
      <rect x="7" y="40" width="4" height="14" rx="2" fill="#fff" fillOpacity="0.28" />
      <rect x="82" y="40" width="4" height="14" rx="2" fill="#fff" fillOpacity="0.28" />

      {/* Seat cushion */}
      <rect x="9" y="66" width="78" height="18" rx="9" fill={`url(#${id}-back)`} stroke={p.trim} strokeOpacity="1" strokeWidth="1.6" />
      <path d="M18 70 H78" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16 80 H80" stroke={p.dark} strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}