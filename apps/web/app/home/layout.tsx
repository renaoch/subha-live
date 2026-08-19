"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/nav/bottom-nav";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function guard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/auth");
        return;
      }

      setReady(true);
    }

    guard();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/auth");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
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

  return (
    <div className="min-h-dvh bg-surface pb-24">
      {children}
      <BottomNav />
    </div>
  );
}