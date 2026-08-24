"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

import { usersApi } from "@/lib/api/users";
import { BdApplicationsPanel } from "@/components/agency/bd-applications-panel";

export default function AdminBdApplicationsPage() {
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
      <BdApplicationsPanel />
    </main>
  );
}