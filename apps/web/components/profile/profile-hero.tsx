import Image from "next/image";

import { CopyIdButton } from "@/components/CopyIdButton";
import type { PrivateProfile } from "@/lib/types";

const numberFormat = new Intl.NumberFormat("en-US");

interface ProfileHeroProps {
  profile: PrivateProfile;
}

export function ProfileHero({
  profile,
}: ProfileHeroProps) {
  return (
    <section
      className="relative pt-4"
      aria-label="Profile overview"
    >
      <div className="flex items-center gap-4">
        <AvatarWithHalo
          src={
            profile.avatar ||
            "/avatar-placeholder.jpg"
          }
          name={profile.name || "User"}
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1
              className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#F3ECE0]"
              title={profile.name || "User"}
            >
              {profile.name || "User"}
            </h1>

            {profile.is_verified && (
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CBA35C] text-[10px] font-bold text-[#17131F]"
                aria-label="Verified"
                title="Verified"
              >
                ✓
              </span>
            )}
          </div>

          {profile.handle && (
            <p className="mt-0.5 truncate text-sm text-[#9088A0]">
              @{profile.handle}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#2A2238] px-2.5 py-0.5 text-xs font-semibold text-[#CBA35C]">
              Lv.{profile.level}
            </span>

            <span className="rounded-full bg-[#2A2238] px-2.5 py-0.5 text-xs font-medium tabular-nums text-[#9088A0]">
              {numberFormat.format(profile.diamonds)}{" "}
              diamonds
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1 text-xs text-[#9088A0]">
            <span className="tabular-nums">
              ID {profile.id}
            </span>

            <CopyIdButton id={profile.id} />
          </div>
        </div>
      </div>

      <StatsRow
        following={profile.following}
        followers={profile.followers}
        level={profile.level}
      />
    </section>
  );
}

interface AvatarWithHaloProps {
  src: string;
  name: string;
}

function AvatarWithHalo({
  src,
  name,
}: AvatarWithHaloProps) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 76,
        height: 76,
      }}
    >
      <svg
        viewBox="0 0 76 76"
        width={76}
        height={76}
        className="absolute inset-0"
        aria-hidden="true"
      >
        <circle
          cx="38"
          cy="38"
          r="35.5"
          fill="none"
          stroke="#CBA35C"
          strokeWidth="1.5"
          strokeDasharray="167 223"
          strokeDashoffset="-18"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>

      <div className="absolute inset-[6px] overflow-hidden rounded-full bg-[#2A2238]">
        <Image
          src={src}
          alt={`${name}'s profile photo`}
          fill
          sizes="64px"
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}

interface StatsRowProps {
  following: number;
  followers: number;
  level: number;
}

function StatsRow({
  following,
  followers,
  level,
}: StatsRowProps) {
  const stats = [
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

  return (
    <dl className="mt-5 flex items-stretch justify-between rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-2 py-3.5">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`flex flex-1 flex-col items-center gap-0.5 ${
            index !== 0
              ? "border-l border-[#2A2238]"
              : ""
          }`}
        >
          <dt className="order-2 text-[11px] text-[#9088A0]">
            {stat.label}
          </dt>

          <dd className="relative order-1 text-base font-semibold tabular-nums text-[#F3ECE0]">
            {numberFormat.format(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}