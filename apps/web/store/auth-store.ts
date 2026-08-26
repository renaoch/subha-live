// File: apps/web/store/auth-store.ts
//
// Global auth state. This is intentionally *thin*: it just mirrors the
// Supabase session so any component can read `user`/`isAuthed` synchronously
// without an effect + fetch. The real source of truth is still Supabase;
// this store is a fast, persisted cache of it.
//
// Persisting a minimal user snapshot means on page load we can paint the
// authed UI immediately (from localStorage) instead of showing a spinner
// until `supabase.auth.getUser()` resolves. Supabase still verifies the
// session in the background and this store gets corrected if it was wrong.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";

interface AuthSnapshot {
  id: string;
  email?: string | null;
}

interface AuthState {
  user: AuthSnapshot | null;
  isAuthed: boolean;
  /** True once we've heard back from Supabase at least once this session. */
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setHydrated: (value: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthed: false,
      hydrated: false,
      setUser: (user) =>
        set({
          user: user ? { id: user.id, email: user.email } : null,
          isAuthed: !!user,
          hydrated: true,
        }),
      setHydrated: (value) => set({ hydrated: value }),
      clear: () => set({ user: null, isAuthed: false, hydrated: true }),
    }),
    {
      name: "subha-auth",
      partialize: (state) => ({ user: state.user, isAuthed: state.isAuthed }),
    },
  ),
);
