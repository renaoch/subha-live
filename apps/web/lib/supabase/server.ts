import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://vxcrfpgicvmclnjyszmu.supabase.co";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.JWT;

  if (!supabaseAnonKey) {
    throw new Error("Supabase anon key is not configured");
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            for (const {
              name,
              value,
              options,
            } of cookiesToSet) {
              cookieStore.set(
                name,
                value,
                options,
              );
            }
          } catch {
            // Cookie writes may fail inside
            // Server Components. Middleware
            // handles session refresh.
          }
        },
      },
    },
  );
}
