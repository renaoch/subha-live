"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { profileMenuItems } from "./profile-menu-items";
import { warmProfilePages } from "@/lib/page-cache";
import type { PrivateProfile } from "@/lib/types";

// Each tile gets its own colour so the grid reads as a lively, scannable set.
const TILE_COLORS = [
  ["#FFD36E", "#E8A22E"], ["#B79BFF", "#6D3FE0"], ["#7DE8FF", "#1BA8D8"], ["#FF9FC0", "#E03C82"],
  ["#8DF0B8", "#26A96B"], ["#FFB27A", "#E8602C"],
] as const;

export function ProfileMenu({ profile }: { profile: PrivateProfile | null }) {
  const router = useRouter();

  useEffect(() => {
    warmProfilePages();
  }, []);
  const role = profile?.role ?? "user";
  const isAdmin = Boolean(profile?.is_admin);

  // Filter menu items based on role
  const filteredItems = profileMenuItems.filter((item) => {
    // Always show these items for all users
    const alwaysShow = [
      "level",
      "store",
      "tasks",
      "rewards",
      "referrals",
      "family",
      "vip",
      "cp",
      "agency-center",
      "my-post",
      "my-videos",
    ];
    if (alwaysShow.includes(item.id)) {
      return true;
    }

    // BD Center – agency owners or admins
    if (item.id === "bd-center") {
      return role === "agency_owner" || isAdmin;
    }

    // Admin Panel – platform admins / engineers only
    if (item.id === "admin-panel") {
      return isAdmin;
    }

    // Default: show all other items
    return true;
  });

  return (
    <nav
      aria-label="Profile menu"
      className="rounded-3xl border border-white/[0.09] bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl p-4"
    >
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6">
        {filteredItems.map(
          ({ id, label, href, Icon, subtitle }, i) => {
          const [c1, c2] = TILE_COLORS[i % TILE_COLORS.length];
          return (
            <li key={id}>
              <Link
                href={href}
                prefetch
                onMouseDown={() => router.prefetch(href)}
                className="group flex min-h-[88px] flex-col items-center justify-start gap-2 rounded-xl px-1 py-1 text-center transition-colors hover:bg-white/10 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
                  style={{ background: `linear-gradient(145deg, ${c1}, ${c2})`, boxShadow: `0 6px 16px ${c2}66, inset 0 1px 0 rgba(255,255,255,0.45)` }}
                >
                  <Icon className="h-6 w-6 text-white drop-shadow" />
                </span>

                <span className="max-w-[76px] text-[11px] font-semibold leading-4 text-[#EDE6F7]">
                  {label}
                </span>

                {subtitle && (
                  <span className="max-w-[76px] rounded-md bg-[#F5C96A]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none text-[#FFE29A]">
                    {subtitle}
                  </span>
                )}
              </Link>
            </li>
          );
        },
        )}
      </ul>
    </nav>
  );
}