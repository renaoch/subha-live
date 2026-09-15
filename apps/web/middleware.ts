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

// Pages that only make sense for a signed-out visitor. If a request with a
// valid session hits one of these, bounce them straight to /home instead of
// showing the sign-in screen again.
// NOTE: "/auth/callback" is intentionally excluded — that route is what
// establishes the session in the first place and must be allowed to run.
const AUTH_ONLY_PATHS = [
  "/auth",
  "/auth/signup",
  "/auth/email",
];

function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some(
    (path) => pathname === path || pathname === `${path}/`,
  );
}

export async function middleware(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep the public preview renderable when project vars are unavailable;
  // deployed environments still receive both values from Vercel.
  if (!supabaseUrl || !supabaseAnonKey) return response;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in and trying to view a signed-out-only auth page
  // (e.g. /auth) → send them to /home instead of leaving them stuck there.
  if (user && isAuthOnlyPath(request.nextUrl.pathname)) {
    const homeUrl = new URL("/home", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};