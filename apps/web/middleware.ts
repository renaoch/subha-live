import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, GATE_TTL_SECONDS, signGate, verifyGate } from "@/lib/admin-gate/gate";

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


/* ==========================================================================
 * ADMIN GATE
 * ========================================================================== */

const ADMIN_PREFIX = "/admin";

function notFound(): NextResponse {
  const res = new NextResponse("Not found", { status: 404 });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * Verify the Supabase session from cookies, then ask the API (the single
 * source of truth for roles) whether this user is a platform admin.
 * Returns the user id for admins, otherwise null. Fails closed.
 */
async function resolveAdmin(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!supabaseUrl || !supabaseAnonKey || !apiUrl) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {
        /* read-only here; session refresh is handled client-side */
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(); // validates the JWT with Supabase
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: { is_admin?: boolean } };
    return body.user?.is_admin ? user.id : null;
  } catch {
    return null;
  }
}

async function handleAdminGate(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const entry = (process.env.ADMIN_ENTRY_PATH ?? "").replace(/^\/+|\/+$/g, "");
  const secret = process.env.ADMIN_GATE_SECRET ?? "";
  const gateConfigured = entry.length >= 12 && secret.length >= 32;

  // Secret entry URL: only an authenticated admin gets the gate cookie.
  if (gateConfigured && (pathname === `/${entry}` || pathname === `/${entry}/`)) {
    const adminId = await resolveAdmin(request);
    if (!adminId) return notFound();
    const res = NextResponse.redirect(new URL("/admin", request.url));
    res.cookies.set(GATE_COOKIE, await signGate(secret, adminId), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: GATE_TTL_SECONDS,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (pathname !== ADMIN_PREFIX && !pathname.startsWith(`${ADMIN_PREFIX}/`)) return null;

  const adminId = await resolveAdmin(request);
  if (!adminId) return notFound();

  if (gateConfigured && !(await verifyGate(secret, adminId, request.cookies.get(GATE_COOKIE)?.value))) {
    return notFound();
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function middleware(
  request: NextRequest,
) {
  const gated = await handleAdminGate(request);
  if (gated) return gated;

  // Fast path: every non-auth page skips the Supabase network round-trip
  // (supabase.auth.getUser() is a remote call and was delaying every
  // navigation and link prefetch). Session refresh is handled client-side
  // by AuthListener.
  if (!isAuthOnlyPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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