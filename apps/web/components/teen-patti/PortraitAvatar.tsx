// Illustrated human headshot, rendered from a PortraitSpec. Pure SVG — works
// offline, no external requests, no initials/robots. Variation comes from skin
// tone, hair style/colour, outfit, glasses, beard, earrings and backdrop.

import { useId } from "react";
import {
  BACKGROUNDS,
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  type PortraitSpec,
} from "@/lib/teen-patti/opponents";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function PortraitAvatar({ spec, className, title }: { spec: PortraitSpec; className?: string; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const fem = spec.presentation === "f";
  const skin = SKIN_TONES[spec.skin];
  const skinDark = shade(skin, -0.16);
  const skinLight = shade(skin, 0.18);
  const hair = HAIR_COLORS[spec.hairColor];
  const hairDark = shade(hair, -0.3);
  const hairLight = shade(hair, 0.22);
  const outfit = OUTFIT_COLORS[spec.outfitColor];
  const outfitDark = shade(outfit, -0.3);
  const outfitLight = shade(outfit, 0.2);
  const [bgA, bgB] = BACKGROUNDS[spec.background];
  const eye = EYE_COLORS[spec.eyeColor];
  const lip = fem ? shade("#C2566A", skin === SKIN_TONES[5] || skin === SKIN_TONES[4] ? -0.25 : 0) : shade(skin, -0.28);

  // Head geometry
  const rx = fem ? 16.2 : 17.6;
  const ry = fem ? 20.5 : 21.5;
  const cy = 45;
  const jawY = cy + ry;
  const smileDepth = [1.6, 2.6, 3.6][spec.smile];

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title ?? "Player portrait"}>
      <defs>
        <radialGradient id={`${uid}bg`} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor={bgA} />
          <stop offset="100%" stopColor={bgB} />
        </radialGradient>
        <linearGradient id={`${uid}sk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="55%" stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </linearGradient>
        <linearGradient id={`${uid}hr`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hairLight} />
          <stop offset="50%" stopColor={hair} />
          <stop offset="100%" stopColor={hairDark} />
        </linearGradient>
        <linearGradient id={`${uid}ot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={outfitLight} />
          <stop offset="100%" stopColor={outfitDark} />
        </linearGradient>
        <radialGradient id={`${uid}vig`} cx="50%" cy="45%" r="65%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#${uid}bg)`} />
      {/* soft bokeh */}
      <circle cx="18" cy="22" r="9" fill="#fff" opacity="0.07" />
      <circle cx="84" cy="30" r="6" fill="#fff" opacity="0.06" />

      {/* ---- hair, back layer ---- */}
      {spec.hairStyle === "long" && (
        <path d="M30 40 Q28 14 50 13 Q72 14 70 40 L74 86 Q62 92 50 80 Q38 92 26 86 Z" fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "wavy" && (
        <path d="M30 40 Q27 14 50 13 Q73 14 70 40 Q76 56 72 70 Q78 82 70 90 Q60 84 50 82 Q40 84 30 90 Q22 82 28 70 Q24 56 30 40 Z" fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "bob" && (
        <path d="M30 42 Q27 15 50 14 Q73 15 70 42 L71 62 Q60 68 50 62 Q40 68 29 62 Z" fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "bun" && <circle cx="50" cy="15" r="9" fill={`url(#${uid}hr)`} />}

      {/* ---- shoulders / outfit ---- */}
      <path d="M6 100 Q8 76 32 71 L68 71 Q92 76 94 100 Z" fill={`url(#${uid}ot)`} />
      {spec.outfit === "hoodie" && (
        <>
          <path d="M30 71 Q50 86 70 71 Q64 80 50 84 Q36 80 30 71 Z" fill={outfitDark} opacity="0.7" />
          <path d="M44 80 L43 92 M56 80 L57 92" stroke={outfitLight} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {spec.outfit === "collar" && (
        <>
          <path d="M38 71 L50 86 L42 74 Z" fill="#F4F1EA" />
          <path d="M62 71 L50 86 L58 74 Z" fill="#F4F1EA" />
          <path d="M44 72 L50 100 L56 72" fill="#F4F1EA" opacity="0.95" />
        </>
      )}
      {spec.outfit === "blazer" && (
        <>
          <path d="M36 71 L50 100 L64 71 L56 71 L50 84 L44 71 Z" fill="#F1ECE4" />
          <path d="M30 72 L46 100 M70 72 L54 100" stroke={outfitDark} strokeWidth="1.4" opacity="0.6" />
        </>
      )}
      {spec.outfit === "kurta" && (
        <>
          <path d="M40 71 Q50 80 60 71" stroke="#E8C27A" strokeWidth="1.6" fill="none" />
          <path d="M50 78 L50 98" stroke="#E8C27A" strokeWidth="1" opacity="0.8" strokeDasharray="1.6 2.2" />
        </>
      )}
      {spec.outfit === "dress" && (
        <path d="M34 71 Q50 90 66 71" stroke={outfitLight} strokeWidth="1.5" fill="none" opacity="0.8" />
      )}
      {spec.outfit === "tee" && <path d="M38 71 Q50 83 62 71" stroke={outfitDark} strokeWidth="1.8" fill="none" opacity="0.6" />}

      {/* ---- neck ---- */}
      <path d="M43 58 L43 74 Q50 82 57 74 L57 58 Z" fill={skinDark} />
      <path d="M43 62 Q50 68 57 62 L57 58 L43 58 Z" fill="#000" opacity="0.14" />

      {/* ---- ears ---- */}
      <ellipse cx={50 - rx - 0.6} cy={cy + 3} rx="2.8" ry="4.2" fill={skinDark} />
      <ellipse cx={50 + rx + 0.6} cy={cy + 3} rx="2.8" ry="4.2" fill={skinDark} />
      {spec.earrings && (
        <>
          <circle cx={50 - rx - 0.8} cy={cy + 8.5} r="1.7" fill="#F5C96A" />
          <circle cx={50 + rx + 0.8} cy={cy + 8.5} r="1.7" fill="#F5C96A" />
        </>
      )}

      {/* ---- head ---- */}
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={`url(#${uid}sk)`} />
      {/* jaw shadow */}
      <path
        d={`M${50 - rx + 1} ${cy + 8} Q50 ${jawY + 7} ${50 + rx - 1} ${cy + 8} Q50 ${jawY + 1} ${50 - rx + 1} ${cy + 8} Z`}
        fill="#000"
        opacity="0.07"
      />

      {/* ---- beard (behind features) ---- */}
      {spec.beard === "full" && (
        <path
          d={`M${50 - rx} ${cy + 4} Q${50 - rx} ${jawY + 5} 50 ${jawY + 4} Q${50 + rx} ${jawY + 5} ${50 + rx} ${cy + 4} Q${50 + rx - 3} ${cy + 15} 50 ${cy + 13.5} Q${50 - rx + 3} ${cy + 15} ${50 - rx} ${cy + 4} Z`}
          fill={hairDark}
          opacity="0.95"
        />
      )}
      {spec.beard === "stubble" && (
        <path
          d={`M${50 - rx + 1} ${cy + 6} Q${50 - rx + 2} ${jawY + 3} 50 ${jawY + 2.5} Q${50 + rx - 2} ${jawY + 3} ${50 + rx - 1} ${cy + 6} Q${50 + rx - 4} ${cy + 16} 50 ${cy + 15} Q${50 - rx + 4} ${cy + 16} ${50 - rx + 1} ${cy + 6} Z`}
          fill={hairDark}
          opacity="0.34"
        />
      )}

      {/* ---- face ---- */}
      {/* brows */}
      <path d={`M36.5 ${cy - 6.2} Q41.5 ${cy - 8.2} 45.5 ${cy - 6.4}`} stroke={hairDark} strokeWidth={fem ? 1.1 : 1.6} strokeLinecap="round" fill="none" />
      <path d={`M54.5 ${cy - 6.4} Q58.5 ${cy - 8.2} 63.5 ${cy - 6.2}`} stroke={hairDark} strokeWidth={fem ? 1.1 : 1.6} strokeLinecap="round" fill="none" />
      {/* eyes */}
      {[41, 59].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={cy - 1.5} rx="3.5" ry="2.3" fill="#FDFBF7" />
          <circle cx={x} cy={cy - 1.5} r="1.95" fill={eye} />
          <circle cx={x} cy={cy - 1.5} r="0.85" fill="#000" />
          <circle cx={x + 0.8} cy={cy - 2.3} r="0.55" fill="#fff" />
          <path d={`M${x - 3.8} ${cy - 2} Q${x} ${cy - 5} ${x + 3.8} ${cy - 2}`} stroke={fem ? "#1a0f0c" : hairDark} strokeWidth={fem ? 1 : 0.8} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* nose */}
      <path d={`M50 ${cy + 1} Q47.6 ${cy + 7.5} 48.8 ${cy + 8.6} Q50 ${cy + 9.4} 51.2 ${cy + 8.6} Q52.4 ${cy + 7.5} 50 ${cy + 1}`} fill={skinDark} opacity="0.55" />
      {/* cheeks */}
      {fem && (
        <>
          <circle cx="36" cy={cy + 8} r="4" fill="#E86C80" opacity="0.18" />
          <circle cx="64" cy={cy + 8} r="4" fill="#E86C80" opacity="0.18" />
        </>
      )}
      {/* mouth */}
      <path
        d={`M43.6 ${cy + 13.2} Q50 ${cy + 13.2 + smileDepth} 56.4 ${cy + 13.2}`}
        stroke={lip}
        strokeWidth={fem ? 2.1 : 1.7}
        strokeLinecap="round"
        fill="none"
      />
      {spec.smile >= 1 && (
        <path d={`M45.5 ${cy + 13.8} Q50 ${cy + 13.8 + smileDepth * 0.8} 54.5 ${cy + 13.8}`} stroke="#fff" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.8" />
      )}
      {spec.beard === "moustache" && (
        <path d={`M42 ${cy + 11.6} Q46 ${cy + 9.2} 50 ${cy + 11} Q54 ${cy + 9.2} 58 ${cy + 11.6} Q54 ${cy + 12.8} 50 ${cy + 11.8} Q46 ${cy + 12.8} 42 ${cy + 11.6} Z`} fill={hairDark} />
      )}
      {spec.beard === "full" && (
        <path d={`M42.5 ${cy + 11.4} Q46 ${cy + 9.4} 50 ${cy + 10.8} Q54 ${cy + 9.4} 57.5 ${cy + 11.4} Q54 ${cy + 12.4} 50 ${cy + 11.6} Q46 ${cy + 12.4} 42.5 ${cy + 11.4} Z`} fill={hairDark} />
      )}

      {/* ---- glasses ---- */}
      {spec.accessory === "glasses" && (
        <g fill="none" stroke="#2B2B33" strokeWidth="1.3">
          <rect x="35" y={cy - 5.4} width="12" height="8.6" rx="3.4" />
          <rect x="53" y={cy - 5.4} width="12" height="8.6" rx="3.4" />
          <path d={`M47 ${cy - 1.5} Q50 ${cy - 3} 53 ${cy - 1.5}`} />
          <path d={`M35 ${cy - 2.5} L${50 - rx} ${cy - 3} M65 ${cy - 2.5} L${50 + rx} ${cy - 3}`} />
        </g>
      )}
      {spec.accessory === "sunglasses" && (
        <g>
          <rect x="34.4" y={cy - 5.6} width="13.2" height="8.6" rx="3.6" fill="#101014" />
          <rect x="52.4" y={cy - 5.6} width="13.2" height="8.6" rx="3.6" fill="#101014" />
          <path d={`M47.4 ${cy - 3.2} L52.6 ${cy - 3.2}`} stroke="#101014" strokeWidth="1.6" />
          <path d={`M36.5 ${cy - 4} L41 ${cy - 4.6}`} stroke="#fff" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
          <path d={`M54.5 ${cy - 4} L59 ${cy - 4.6}`} stroke="#fff" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
        </g>
      )}

      {/* ---- hair, front layer ---- */}
      {spec.hairStyle === "long" && (
        <path d={`M31 ${cy - 2} Q30 ${cy - 26} 50 ${cy - 27} Q70 ${cy - 26} 69 ${cy - 2} Q66 ${cy - 17} 52 ${cy - 20} Q40 ${cy - 16} 31 ${cy - 2} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "wavy" && (
        <path d={`M31 ${cy} Q29 ${cy - 27} 50 ${cy - 27.5} Q71 ${cy - 27} 69 ${cy} Q65 ${cy - 14} 56 ${cy - 17} Q45 ${cy - 21} 36 ${cy - 8} Q33 ${cy - 4} 31 ${cy} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "bob" && (
        <path d={`M30.5 ${cy + 4} Q28 ${cy - 28} 50 ${cy - 28} Q72 ${cy - 28} 69.5 ${cy + 4} Q66 ${cy - 14} 54 ${cy - 17} Q42 ${cy - 14} 30.5 ${cy + 4} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "bun" && (
        <path d={`M32 ${cy - 3} Q31 ${cy - 26} 50 ${cy - 26.5} Q69 ${cy - 26} 68 ${cy - 3} Q63 ${cy - 16} 50 ${cy - 17} Q37 ${cy - 16} 32 ${cy - 3} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "sideBangs" && (
        <>
          <path d="M30 42 Q27 15 50 14 Q73 15 70 42 L71 66 Q64 70 62 56 Q60 36 50 28 Q38 30 33 52 Q32 62 30 66 Z" fill={`url(#${uid}hr)`} />
          <path d={`M33 ${cy - 4} Q38 ${cy - 22} 62 ${cy - 17} Q50 ${cy - 17} 38 ${cy + 2} Z`} fill={`url(#${uid}hr)`} />
        </>
      )}
      {spec.hairStyle === "short" && (
        <path d={`M32 ${cy - 5} Q30 ${cy - 26} 50 ${cy - 27} Q70 ${cy - 26} 68 ${cy - 5} Q66 ${cy - 14} 60 ${cy - 17} Q50 ${cy - 20} 40 ${cy - 17} Q34 ${cy - 14} 32 ${cy - 5} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "quiff" && (
        <path d={`M32 ${cy - 5} Q28 ${cy - 24} 44 ${cy - 29} Q60 ${cy - 33} 69 ${cy - 17} Q69 ${cy - 10} 68 ${cy - 5} Q65 ${cy - 15} 58 ${cy - 17} Q47 ${cy - 21} 38 ${cy - 14} Q34 ${cy - 11} 32 ${cy - 5} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "sidePart" && (
        <path d={`M32 ${cy - 4} Q29 ${cy - 26} 50 ${cy - 27} Q71 ${cy - 26} 68 ${cy - 4} Q66 ${cy - 12} 62 ${cy - 15} Q48 ${cy - 14} 37 ${cy - 17} Q33 ${cy - 11} 32 ${cy - 4} Z`} fill={`url(#${uid}hr)`} />
      )}
      {spec.hairStyle === "curly" && (
        <g fill={`url(#${uid}hr)`}>
          {[[34, 28], [41, 22], [50, 20], [59, 22], [66, 28], [31, 36], [69, 36], [45, 25], [55, 25], [38, 30], [62, 30]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i < 5 ? 7 : 5.5} />
          ))}
        </g>
      )}
      {spec.hairStyle === "buzz" && (
        <path d={`M32.5 ${cy - 6} Q31 ${cy - 24} 50 ${cy - 24.5} Q69 ${cy - 24} 67.5 ${cy - 6} Q64 ${cy - 15} 50 ${cy - 16} Q36 ${cy - 15} 32.5 ${cy - 6} Z`} fill={hair} opacity="0.92" />
      )}

      <rect width="100" height="100" fill={`url(#${uid}vig)`} />
    </svg>
  );
}