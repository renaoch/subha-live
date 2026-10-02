"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { profileMenuItems } from "./profile-menu-items";
import { warmProfilePages } from "@/lib/page-cache";
import type { PrivateProfile } from "@/lib/types";

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
      className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
    >
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6">
        {filteredItems.map(
          ({ id, label, href, Icon, subtitle }) => (
            <li key={id}>
              <Link
                href={href}
                prefetch
                onMouseDown={() => router.prefetch(href)}
                className="group flex min-h-[88px] flex-col items-center justify-start gap-2 rounded-xl px-1 py-1 text-center transition-colors hover:bg-[#2A2238]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2A2238] transition-colors group-hover:bg-[#332A45]">
                  <Icon className="h-6 w-6 text-[#CBA35C]" />
                </span>

                <span className="max-w-[76px] text-[11px] font-medium leading-4 text-[#D9D2E0]">
                  {label}
                </span>

                {subtitle && (
                  <span className="max-w-[76px] rounded-md bg-[#CBA35C]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none text-[#CBA35C]">
                    {subtitle}
                  </span>
                )}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}