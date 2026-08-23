"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Gem,
  Sparkles,
  Copy,
  Check,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { PrivateProfile } from "@/lib/types";

const numberFormat = new Intl.NumberFormat("en-US");

interface ProfileHeroProps {
  profile: PrivateProfile;
}

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
  const index = Math.min(
    TIER_PALETTE.length - 1,
    Math.floor((Math.max(1, level) - 1) / TIER_SIZE),
  );

  return TIER_PALETTE[index];
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const theme = tierForLevel(profile.level);

  /*
   * public_id is now the canonical profile User ID
   * stored in public.profiles.public_id.
   *
   * Do NOT generate it from profile.id anymore.
   */
  const userId = profile.public_id;

  const [copied, setCopied] = useState(false);

  const copyTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      const input = document.createElement("input");

      input.value = userId;

      document.body.appendChild(input);

      input.select();

      document.execCommand("copy");

      document.body.removeChild(input);

      setCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  return (
    <section
      className="relative pt-4"
      aria-label="Profile overview"
    >
      <HeroMotionStyles />

      <Link
        href="/profile/edit"
        aria-label="Edit profile"
        className="absolute right-0 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2238] bg-[#1D1829]/80 text-[#9088A0] transition-all duration-200 hover:border-[#CBA35C]/40 hover:bg-[#2A2238] hover:text-[#CBA35C] active:scale-95"
      >
        <Pencil className="h-4 w-4" />
      </Link>

      <div className="flex items-center gap-4">
        <AvatarWithHalo
          src={profile.avatar}
          name={profile.name || "User"}
          level={profile.level}
          theme={theme}
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 pr-10">
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

            {profile.country_flag && (
              <span
                className="text-xl leading-none"
                title={profile.country || undefined}
              >
                {profile.country_flag}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "group relative flex items-center gap-1.5 rounded-full border border-[#2A2238] bg-[#1D1829]/80 px-3 py-1 transition-all duration-200 hover:border-[#CBA35C]/50 hover:bg-[#2A2238] hover:shadow-[0_0_20px_rgba(203,163,92,0.1)]",
                copied &&
                  "border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.15)]",
              )}
            >
              <span className="font-mono text-xs font-bold tracking-wider text-[#9088A0] transition-colors group-hover:text-[#F3ECE0]">
                #{userId}
              </span>

              <span className="text-[#9088A0] transition-colors group-hover:text-[#CBA35C]">
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </span>

              <span
                className={cn(
                  "absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#2A2238] px-2 py-0.5 text-[9px] font-medium text-[#F3ECE0] opacity-0 transition-all duration-200",
                  copied && "opacity-100",
                )}
              >
                Copied!
              </span>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black"
              style={{
                color: theme.accent,
                borderColor: `${theme.primary}55`,
                background: `linear-gradient(135deg, ${theme.primary}30, ${theme.primary}0C)`,
              }}
            >
              <Sparkles
                className="h-3 w-3"
                style={{ color: theme.primary }}
              />

              Lv.{profile.level}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#2A2238] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#9088A0]">
              <Gem className="h-3 w-3 text-[#7FD8E8]" />

              {numberFormat.format(profile.diamonds)}
            </span>
          </div>
        </div>
      </div>

      <StatsRow
        following={profile.following}
        followers={profile.followers}
        level={profile.level}
        country={profile.country}
        countryFlag={profile.country_flag}
      />
    </section>
  );
}

function HeroMotionStyles() {
  return (
    <style>{`
      @keyframes ph-rainbow-spin {
        to {
          --ph-angle: 360deg;
        }
      }

      @property --ph-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }

      @keyframes ph-glow-pulse {
        0%, 100% {
          opacity: 0.55;
        }

        50% {
          opacity: 1;
        }
      }

      .ph-max-ring {
        background: conic-gradient(
          from var(--ph-angle),
          #F5B93F,
          #FF6CA8,
          #A86CFF,
          #57C2FF,
          #F5B93F
        );

        animation: ph-rainbow-spin 5s linear infinite;
      }

      .ph-glow {
        animation: ph-glow-pulse 2.6s ease-in-out infinite;
      }
    `}</style>
  );
}

interface AvatarWithHaloProps {
  src: string | null | undefined;
  name: string;
  level: number;
  theme: {
    primary: string;
    accent: string;
  };
}

function AvatarWithHalo({
  src,
  name,
  level,
  theme,
}: AvatarWithHaloProps) {
  const [failed, setFailed] = useState(false);

  const isMax = level >= MAX_LEVEL;

  const showImage = Boolean(src?.trim()) && !failed;

  const initial =
    name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="relative shrink-0"
      style={{
        width: 76,
        height: 76,
      }}
    >
      <div
        className={`absolute inset-0 rounded-full ${
          isMax ? "ph-max-ring" : "ph-glow"
        } p-[2px]`}
        style={
          isMax
            ? undefined
            : {
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
              }
        }
      >
        <div className="h-full w-full rounded-full bg-[#17131F]" />
      </div>

      <div
        className="absolute inset-[6px] overflow-hidden rounded-full"
        style={{
          boxShadow: `0 0 18px ${theme.primary}55`,
        }}
      >
        {showImage ? (
          <img
            src={src as string}
            alt={`${name}'s profile photo`}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            onError={() => {
              setFailed(true);
            }}
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
  country?: string | null;
  countryFlag?: string | null;
}

function StatsRow({
  following,
  followers,
  level,
  country,
  countryFlag,
}: StatsRowProps) {
  const stats: Array<{
    label: string;
    value: string | number;
  }> = [
    {
      label: "Followers",
      value: followers,
    },
    {
      label: "Following",
      value: following,
    },
    {
      label: "Level",
      value: level,
    },
  ];

  if (countryFlag) {
    stats.push({
      label: country || "Country",
      value: countryFlag,
    });
  }

  return (
    <dl className="mt-5 flex items-stretch justify-between rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-2 py-3.5">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1",
            index !== stats.length - 1 &&
              "border-r border-[#2A2238]",
          )}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#9088A0]">
            {stat.label}
          </dt>

          <dd className="text-sm font-bold tabular-nums text-[#F3ECE0]">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}