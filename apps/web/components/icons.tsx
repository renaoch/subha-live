// Hand-picked, single-stroke-weight icon set so the menu grid reads as one
// consistent family instead of mixed emoji/stock icons. Kept dependency-free
// (plain inline SVG) to avoid pulling in an icon library for eight glyphs.

interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function GiftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16" />
      <path d="M12 9v11" />
      <path d="M12 9C10.5 5.5 6 5.5 6 8s3 1.5 6 1z" />
      <path d="M12 9c1.5-3.5 6-3.5 6-1s-3 1.5-6 1z" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4.5A2.5 2.5 0 0 0 7 9.5" />
      <path d="M17 6h2.5A2.5 2.5 0 0 1 17 9.5" />
      <path d="M12 14v3" />
      <path d="M9 20h6" />
      <path d="M9.5 17h5l.5 3H9l.5-3z" />
    </svg>
  );
}

export function GameIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="8" width="18" height="9" rx="4" />
      <path d="M8 11v4" />
      <path d="M6 13h4" />
      <circle cx="16" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StoreIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9l1.5-4h13L20 9" />
      <path d="M4 9v9.5a1.5 1.5 0 0 0 1.5 1.5H9v-6h6v6h3.5a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function InviteIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M17 8h4" />
      <path d="M19 6v4" />
    </svg>
  );
}

export function MedalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="14" r="5.5" />
      <path d="M9.5 11.5 12 16l2.5-4.5" />
      <path d="M8.5 4 12 10l3.5-6" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 19.5s-7-4.35-9-8.5C1.2 7.6 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.8 3.1 4 6.5-2 4.15-9 8.5-9 8.5z" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 19 6v6c0 5-3 7.8-7 8.5-4-.7-7-3.5-7-8.5V6l7-2.5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function HeadsetIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M19 19v.5A2.5 2.5 0 0 1 16.5 22H13" />
    </svg>
  );
}