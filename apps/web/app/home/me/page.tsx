"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import { CopyIdButton } from "@/components/CopyIdButton";
import { usersApi } from "@/lib/api/users";
import type { Profile } from "@/lib/types";
import {
  GiftIcon,
  TrophyIcon,
  GameIcon,
  StoreIcon,
  InviteIcon,
  MedalIcon,
  HeartIcon,
  ShieldIcon,
  HeadsetIcon,
} from "@/components/icons";

// ---- Fonts ---------------------------------------------------------------

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

// ---- Menu ----------------------------------------------------------------

const menuItems = [
  {
    label: "Reward",
    href: "/reward",
    Icon: GiftIcon,
  },
  {
    label: "Rank",
    href: "/rank",
    Icon: TrophyIcon,
  },
  {
    label: "Game",
    href: "/game",
    Icon: GameIcon,
  },
  {
    label: "Store",
    href: "/store",
    Icon: StoreIcon,
  },
  {
    label: "Invite",
    href: "/invite",
    Icon: InviteIcon,
  },
  {
    label: "Medal",
    href: "/medal",
    Icon: MedalIcon,
  },
  {
    label: "Fans club",
    href: "/fans-club",
    Icon: HeartIcon,
  },
  {
    label: "Auth",
    href: "/auth",
    Icon: ShieldIcon,
  },
] as const;

// ---- Shared number formatter ---------------------------------------------

const numberFormat = new Intl.NumberFormat("en-US");

// ---- Page -----------------------------------------------------------------

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const user = await usersApi.me();

        if (!cancelled) {
          setProfile(user);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <ProfileLoading />;
  }

  if (error || !profile) {
    return (
      <ProfileError
        message={error ?? "Unable to load profile."}
      />
    );
  }

  return (
    <main
      className={`${display.variable} ${body.variable} min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased`}
    >
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        <ProfileHero profile={profile} />

        <VipBanner
          isVip={
            profile.svip ||
            profile.vip_level > 0
          }
        />

        <WalletRow
          coins={profile.coins}
          diamonds={profile.diamonds}
        />

        <MenuGrid />

        <SupportBanner />
      </div>
    </main>
  );
}

// ---- Loading --------------------------------------------------------------

function ProfileLoading() {
  return (
    <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        {/* Hero skeleton */}
        <section className="pt-4">
          <div className="flex items-center gap-4">
            <div className="h-[76px] w-[76px] shrink-0 animate-pulse rounded-full bg-[#2A2238]" />

            <div className="min-w-0 flex-1">
              <div className="h-7 w-36 animate-pulse rounded-lg bg-[#2A2238]" />

              <div className="mt-2 h-5 w-24 animate-pulse rounded-full bg-[#2A2238]" />

              <div className="mt-2 h-4 w-28 animate-pulse rounded bg-[#2A2238]" />
            </div>
          </div>

          <div className="mt-5 h-20 animate-pulse rounded-2xl bg-[#1D1829]" />
        </section>

        {/* VIP skeleton */}
        <div className="h-[72px] animate-pulse rounded-2xl bg-[#1D1829]" />

        {/* Wallet skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[78px] animate-pulse rounded-2xl bg-[#1D1829]" />
          <div className="h-[78px] animate-pulse rounded-2xl bg-[#1D1829]" />
        </div>

        {/* Menu skeleton */}
        <div className="h-[210px] animate-pulse rounded-2xl bg-[#1D1829]" />

        {/* Support skeleton */}
        <div className="h-[68px] animate-pulse rounded-2xl bg-[#1D1829]" />
      </div>
    </main>
  );
}

// ---- Error ----------------------------------------------------------------

function ProfileError({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      <div className="mx-auto max-w-md px-4 pb-10 pt-10">
        <div className="rounded-2xl border border-[#3A2634] bg-[#1D1829] p-5">
          <h1 className="text-lg font-semibold">
            Unable to load profile
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#9088A0]">
            {message}
          </p>
        </div>
      </div>
    </main>
  );
}

// ---- Hero -----------------------------------------------------------------

function ProfileHero({
  profile,
}: {
  profile: Profile;
}) {
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
              {numberFormat.format(profile.diamonds)} diamonds
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

// ---- Avatar ---------------------------------------------------------------

function AvatarWithHalo({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
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

// ---- Stats ----------------------------------------------------------------

function StatsRow({
  following,
  followers,
  level,
}: {
  following: number;
  followers: number;
  level: number;
}) {
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
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex flex-1 flex-col items-center gap-0.5 ${
            i !== 0
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

// ---- VIP ------------------------------------------------------------------

function VipBanner({
  isVip,
}: {
  isVip: boolean;
}) {
  return (
    <a
      href="/vip"
      className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#CBA35C]/30 bg-gradient-to-r from-[#241D1A] to-[#1D1829] px-4 py-3.5 transition-colors hover:border-[#CBA35C]/50"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#CBA35C]/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <ShieldIcon className="h-6 w-6 text-[#CBA35C]" />

        <div>
          <p className="text-sm font-semibold text-[#CBA35C]">
            {isVip ? "VIP active" : "Unlock VIP"}
          </p>

          <p className="text-xs text-[#9088A0]">
            Exclusive frames, badges &amp; privileges
          </p>
        </div>
      </div>

      <span className="relative shrink-0 rounded-full border border-[#CBA35C]/40 px-3 py-1.5 text-xs font-medium text-[#CBA35C] transition-colors group-hover:bg-[#CBA35C]/10">
        View
      </span>
    </a>
  );
}

// ---- Wallet ---------------------------------------------------------------

function WalletRow({
  coins,
  diamonds,
}: {
  coins: number;
  diamonds: number;
}) {
  const items = [
    {
      label: "Coins",
      value: coins,
      color: "#CBA35C",
    },
    {
      label: "Diamonds",
      value: diamonds,
      color: "#D98FA0",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5"
        >
          <p className="text-xs text-[#9088A0]">
            {item.label}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: item.color,
              }}
              aria-hidden="true"
            />

            {numberFormat.format(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---- Menu -----------------------------------------------------------------

function MenuGrid() {
  return (
    <nav
      aria-label="Profile menu"
      className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-2"
    >
      <ul className="grid grid-cols-4 gap-y-4">
        {menuItems.map(
          ({ label, href, Icon }) => (
            <li key={label}>
              <a
                href={href}
                className="flex flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors hover:bg-[#2A2238]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2A2238]">
                  <Icon className="h-5 w-5 text-[#CBA35C]" />
                </span>

                <span className="text-[11px] text-[#D9D2E0]">
                  {label}
                </span>
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

// ---- Support --------------------------------------------------------------

function SupportBanner() {
  return (
    <a
      href="/support"
      className="flex items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5 transition-colors hover:border-[#3A3050]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2238]">
        <HeadsetIcon className="h-4.5 w-4.5 text-[#D98FA0]" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#F3ECE0]">
          Need help? We&apos;re here.
        </p>

        <p className="truncate text-xs text-[#9088A0]">
          Reach support any time — usually replies in minutes.
        </p>
      </div>
    </a>
  );
}