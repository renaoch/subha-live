import { NextRequest, NextResponse } from "next/server";

const SUPPORTED = new Set(["google", "facebook"]);

// This is a stub for wiring up real OAuth (e.g. NextAuth.js / Auth.js,
// Clerk, or a custom provider). It exists so the client component in
// components/auth/auth-screen.tsx has a real endpoint to call.
export async function POST(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  const { provider } = params;

  if (!SUPPORTED.has(provider)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  // TODO: kick off the provider's OAuth flow and return a redirect URL,
  // or perform the exchange server-side and set a session cookie.
  return NextResponse.json({ ok: true, provider });
}
