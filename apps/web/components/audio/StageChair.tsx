"use client";

// A premium lounge-chair silhouette used behind each seated avatar. Pure
// decorative SVG so it can't affect audio/seat state. `tone` switches the
// palette: host gold vs. guest violet.

interface StageChairProps {
  tone?: "host" | "guest";
  className?: string;
}

export function StageChair({ tone = "guest", className }: StageChairProps) {
  const id = tone === "host" ? "host" : "guest";
  const backTop = tone === "host" ? "#F5C96A" : "#8B6BF0";
  const backBottom = tone === "host" ? "#B8863A" : "#4A2E8C";

  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`chair-back-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={backTop} stopOpacity="0.5" />
          <stop offset="100%" stopColor={backBottom} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`chair-cushion-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={backTop} stopOpacity="0.85" />
          <stop offset="100%" stopColor={backBottom} stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Backrest arch */}
      <path
        d="M15 6 C15 2 81 2 81 6 L81 50 C81 63 70 72 48 72 C26 72 15 63 15 50 Z"
        fill={`url(#chair-back-${id})`}
        stroke={backTop}
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      {/* Backrest inner highlight */}
      <path
        d="M22 12 C22 9 74 9 74 12 L74 46 C74 56 66 63 48 63 C30 63 22 56 22 46 Z"
        fill="none"
        stroke={backTop}
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {/* Armrests */}
      <rect x="8" y="34" width="9" height="30" rx="4.5" fill={`url(#chair-cushion-${id})`} stroke={backTop} strokeOpacity="0.3" strokeWidth="1" />
      <rect x="79" y="34" width="9" height="30" rx="4.5" fill={`url(#chair-cushion-${id})`} stroke={backTop} strokeOpacity="0.3" strokeWidth="1" />

      {/* Seat cushion */}
      <rect x="14" y="68" width="68" height="15" rx="7.5" fill={`url(#chair-cushion-${id})`} stroke={backTop} strokeOpacity="0.4" strokeWidth="1.2" />

      {/* Legs */}
      <rect x="20" y="83" width="5" height="9" rx="2" fill={backBottom} opacity="0.55" />
      <rect x="71" y="83" width="5" height="9" rx="2" fill={backBottom} opacity="0.55" />
    </svg>
  );
}
