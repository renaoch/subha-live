"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { BadgeCheck, Gem, Sparkles } from "lucide-react";

import type { PrivateProfile } from "@/lib/types";

const numberFormat = new Intl.NumberFormat("en-US");

interface ProfileHeroProps {
  profile: PrivateProfile;
}

/**
 * Generate a stable 7-digit user ID from a UUID
 * Simple hash - not CPU intensive, just uses string operations
 */
function generateUserId(uuid: string): string {
  // Remove hyphens and get first 8 chars for a simple hash
  const clean = uuid.replace(/-/g, "");
  
  // Simple hash: sum of character codes with a multiplier
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) & 0x7FFFFFFF; // Keep within 31-bit
  }
  
  // Ensure 7 digits (pad with leading zeros if needed)
  const userId = (hash % 10_000_000).toString().padStart(7, "0");
  return userId;
}

/**
 * Same 10-tier palette used on the Level Rewards card, so a player's rank
 * reads consistently everywhere it shows up. If you already centralized
 * this elsewhere (e.g. `lib/level-theme.ts`), swap this out for that import.
 */
const TIER_PALETTE = [
  { name: "Bronze", primary: "#D98F4E", accent: "#FFCF9E" },
  { name: "Silver", primary: "#AEB9C7", accent: "#EAF0F6" },
  { name: "Gold", primary: "#F5B93F", accent: "#FFE29E" },
  { name: "Platinum", primary: "#5FD9C4", accent: "#B4F5E7" },
  { name: "Diamond", primary: "#57C2FF", accent: "#B3E6FF" },
  { name: "Master", primary: "#A86CFF", accent: "#DCC2FF" },
  { name: "Grandmaster", primary: "#FF6CA8", accent: "#FFC0DA" },
  { name: "Elite", primary: "#FF8A5C", accent: "#FFCBAE" },
  { name: "Legend", primary: "#FFD24C", accent: "#FFF0B8" },
  { name: "Mythic", primary: "#F5B93F", accent: "#F8F1E6" },
] as const;

const TIER_SIZE = 10;
const MAX_LEVEL = 100;

function tierForLevel(level: number) {
  const idx = Math.min(TIER_PALETTE.length - 1, Math.floor((Math.max(1, level) - 1) / TIER_SIZE));
  return TIER_PALETTE[idx];
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const theme = tierForLevel(profile.level);
  
  // Generate 7-digit user ID from UUID
  const userId = useMemo(() => generateUserId(profile.id), [profile.id]);

  return (
    <section className="relative pt-4" aria-label="Profile overview">
      <HeroMotionStyles />

      <div className="flex items-center gap-4">
        <AvatarWithHalo
          src={profile.avatar}
          name={profile.name || "User"}
          level={profile.level}
          theme={theme}
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1
              className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#F3ECE0]"
              title={profile.name || "User"}
            >
              {profile.name || "User"}
            </h1>

            {profile.is_verified && (
              <BadgeCheck
                className="h-5 w-5 shrink-0 fill-[#CBA35C] text-[#17131F]"
                aria-label="Verified"
              />
            )}
          </div>

          {profile.handle && (
            <p className="mt-0.5 truncate text-sm text-[#9088A0]">@{profile.handle}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black"
              style={{
                color: theme.accent,
                borderColor: `${theme.primary}55`,
                background: `linear-gradient(135deg, ${theme.primary}30, ${theme.primary}0C)`,
              }}
            >
              <Sparkles className="h-3 w-3" style={{ color: theme.primary }} />
              Lv.{profile.level}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#2A2238] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#9088A0]">
              <Gem className="h-3 w-3 text-[#7FD8E8]" />
              {numberFormat.format(profile.diamonds)}
            </span>

            {/* 7-digit User ID */}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1D1829] px-2.5 py-1 text-xs font-mono tabular-nums text-[#6A6078] border border-[#2A2238]">
              <span className="text-[10px]">#</span>
              {userId}
            </span>
          </div>
        </div>
      </div>

      <StatsRow following={profile.following} followers={profile.followers} level={profile.level} />
    </section>
  );
}

function HeroMotionStyles() {
  return (
    <style>{`
      @keyframes ph-rainbow-spin { to { --ph-angle: 360deg; } }
      @property --ph-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }
      @keyframes ph-glow-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
      .ph-max-ring {
        background: conic-gradient(from var(--ph-angle), #F5B93F, #FF6CA8, #A86CFF, #57C2FF, #F5B93F);
        animation: ph-rainbow-spin 5s linear infinite;
      }
      .ph-glow { animation: ph-glow-pulse 2.6s ease-in-out infinite; }
    `}</style>
  );
}

interface AvatarWithHaloProps {
  src: string | null | undefined;
  name: string;
  level: number;
  theme: { primary: string; accent: string };
}

function AvatarWithHalo({ src, name, level, theme }: AvatarWithHaloProps) {
  const [failed, setFailed] = useState(false);
  const isMax = level >= MAX_LEVEL;
  const showImage = Boolean(src) && !failed;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
      {/* Halo ring */}
      <div
        className={`absolute inset-0 rounded-full ${isMax ? "ph-max-ring" : "ph-glow"} p-[2px]`}
        style={isMax ? undefined : { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
      >
        <div className="h-full w-full rounded-full bg-[#17131F]" />
      </div>

      <div
        className="absolute inset-[6px] overflow-hidden rounded-full"
        style={{ boxShadow: `0 0 18px ${theme.primary}55` }}
      >
        {showImage ? (
          <Image
            src={src as string}
            alt={`${name}'s profile photo`}
            fill
            sizes="64px"
            className="object-cover"
            priority
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-black"
            style={{
              color: theme.accent,
              background: `linear-gradient(135deg, ${theme.primary}55, #2A2238)`,
            }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsRowProps {
  following: number;
  followers: number;
  level: number;
}

function StatsRow({ following, followers, level }: StatsRowProps) {
  const stats = [
    { label: "Followers", value: followers },
    { label: "Following", value: following },
    { label: "Level", value: level },
  ];

  return (
    <dl className="mt-5 flex items-stretch justify-between rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-2 py-3.5">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`flex flex-1 flex-col items-center gap-0.5 ${index !== 0 ? "border-l border-[#2A2238]" : ""}`}
        >
          <dt className="order-2 text-[11px] text-[#9088A0]">{stat.label}</dt>
          <dd className="relative order-1 text-base font-semibold tabular-nums text-[#F3ECE0]">
            {numberFormat.format(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}