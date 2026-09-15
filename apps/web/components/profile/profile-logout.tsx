"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

export function ProfileLogout() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clear);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;

    setLoading(true);

    try {
      const { error } = await authApi.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Sign out error:", error);

      toast.error("Couldn't sign you out", {
        description: "Please check your connection and try again.",
      });

      setLoading(false);
      return;
    }

    // Clear the local session cache immediately so the rest of the app
    // (bottom nav, guards, etc.) reflects the signed-out state right away,
    // then hand off to /auth. Using a hard navigation ensures middleware +
    // all client state fully resets.
    clearAuth();
    router.replace("/auth");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5 text-left transition-colors hover:border-red-500/40 hover:bg-red-500/5",
        loading && "pointer-events-none opacity-70",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2238]">
        <LogOut className="h-4.5 w-4.5 text-red-400" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-red-400">
          {loading ? "Logging out…" : "Log out"}
        </p>

        <p className="truncate text-xs text-[#9088A0]">
          Sign out of your Subha account on this device.
        </p>
      </div>
    </button>
  );
}