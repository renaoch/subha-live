"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Loader2 } from "lucide-react";

import { usersApi } from "@/lib/api/users";

const ADMIN_TABS = [
  { href: "/admin/bd-applications", label: "BD Applications" },
  { href: "/admin/host-task", label: "Host Task" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const profile = await usersApi.me();
        if (!cancelled) setIsAdmin(Boolean(profile.is_admin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#17131F]">
        <Loader2 className="h-6 w-6 animate-spin text-[#9088A0]" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#17131F] px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-red-300/60" />
        <p className="text-sm font-bold text-[#F3ECE0]">Admins only</p>
        <p className="text-xs text-[#9088A0]">
          You don't have access to this page.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#17131F]">
      <nav className="flex gap-1 border-b border-[#2A2238] bg-[#1D1829]/60 px-4 pt-4">
        {ADMIN_TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-t-lg px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[#17131F] text-[#F3ECE0]"
                  : "text-[#9088A0] hover:text-[#D9D2E0]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </main>
  );
}
