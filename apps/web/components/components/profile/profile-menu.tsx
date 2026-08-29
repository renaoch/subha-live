"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { profileMenuItems } from "./profile-menu-items";
import { usersApi } from "@/lib/api/users";
import type { PrivateProfile } from "@/lib/types";

export function ProfileMenu() {
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await usersApi.me();
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
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

    // Host Center – hosts, agency staff, or admins
    if (item.id === "host-center") {
      return (
        role === "agency_owner" ||
        role === "agency_admin" ||
        role === "agency_agent" ||
        isAdmin
      );
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

  if (loading) {
    return (
      <nav className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4">
        <div className="grid grid-cols-4 gap-x-2 gap-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 animate-pulse rounded-full bg-[#2A2238]" />
              <div className="h-3 w-14 animate-pulse rounded bg-[#2A2238]" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Profile menu"
      className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
    >
      <ul className="grid grid-cols-4 gap-x-2 gap-y-6">
        {filteredItems.map(
          ({ id, label, href, Icon }) => (
            <li key={id}>
              <Link
                href={href}
                className="group flex min-h-[88px] flex-col items-center justify-start gap-2 rounded-xl px-1 py-1 text-center transition-colors hover:bg-[#2A2238]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2A2238] transition-colors group-hover:bg-[#332A45]">
                  <Icon className="h-6 w-6 text-[#CBA35C]" />
                </span>

                <span className="max-w-[76px] text-[11px] font-medium leading-4 text-[#D9D2E0]">
                  {label}
                </span>
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}