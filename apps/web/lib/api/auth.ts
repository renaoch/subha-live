import { createClient } from "@/lib/supabase/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const authApi = {
  signInWithGoogle() {
    const supabase = createClient();

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });
  },

  signInWithFacebook() {
    const supabase = createClient();

    return supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });
  },

  signInWithPassword(
    email: string,
    password: string,
  ) {
    const supabase = createClient();

    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  signUp(
    email: string,
    password: string,
  ) {
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
