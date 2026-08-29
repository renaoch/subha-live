// File: apps/web/components/providers/auth-listener.tsx
//
// Single source of truth wiring: mounted once at the root layout, this
// keeps `useAuthStore` in sync with Supabase in the background. Pages no
// longer need their own `supabase.auth.getUser()` effect + loading spinner —
// they just read `useAuthStore()`, which is already hydrated from
// localStorage on first paint and gets corrected here if needed.

"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";

export function AuthListener() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setUser(null);
      return;
    }

    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [setUser]);

  return null;
}
