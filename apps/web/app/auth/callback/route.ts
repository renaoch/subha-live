import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=oauth_failed", url.origin),
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback error:", error);

    return NextResponse.redirect(
      new URL("/auth?error=oauth_failed", url.origin),
    );
  }

  return NextResponse.redirect(
    new URL("/home", url.origin),
  );
}