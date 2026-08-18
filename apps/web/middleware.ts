import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function middleware(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  const supabaseAnonKey = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          for (const {
            name,
            value,
          } of cookiesToSet) {
            request.cookies.set(
              name,
              value,
            );
          }

          response = NextResponse.next({
            request,
          });

          for (const {
            name,
            value,
            options,
          } of cookiesToSet) {
            response.cookies.set(
              name,
              value,
              options,
            );
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};