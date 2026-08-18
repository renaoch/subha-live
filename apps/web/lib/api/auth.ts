import { createClient } from "@/lib/supabase/client";

export const authApi = {
  signInWithGoogle() {
    const supabase = createClient();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  signInWithFacebook() {
    const supabase = createClient();

    return supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  signInWithPassword(email: string, password: string) {
    const supabase = createClient();

    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  signUp(email: string, password: string) {
    const supabase = createClient();

    return supabase.auth.signUp({
      email,
      password,
    });
  },

  signOut() {
    const supabase = createClient();

    return supabase.auth.signOut();
  },
};