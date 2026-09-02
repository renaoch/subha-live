"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { BottomNav } from "@/components/nav/bottom-nav";
import { useAuthStore } from "@/store/auth-store";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isFullScreenRoute =
    pathname?.includes("/room/") ||
    /\/chats\/.+/.test(pathname ?? "");

  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    // Only redirect once we've actually heard back from Supabase -- the
    // persisted store may briefly say isAuthed:false on a hard reload
    // before AuthListener confirms the real session.
    if (hydrated && !isAuthed) {
      router.replace("/auth");
    }
  }, [hydrated, isAuthed, router]);

  // Persisted state from a previous session lets us skip the spinner
  // entirely on repeat visits -- we only block render before *any* signal
  // has arrived (neither persisted state nor a live Supabase response).
  if (!isAuthed && !hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-playhouses-gradient">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border border-border bg-surface-raised/60 shadow-panel">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <p className="text-sm text-ink-muted">Loading Subha…</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) return null;

  return (
    <div className={isFullScreenRoute ? "min-h-dvh bg-surface" : "min-h-dvh bg-surface pb-24"}>
      {children}
      {!isFullScreenRoute && <BottomNav />}
    </div>
  );
}