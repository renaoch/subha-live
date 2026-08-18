import { createBrowserClient } from "@supabase/ssr";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function createClient() {
  const supabaseUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const supabaseAnonKey = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  );
}