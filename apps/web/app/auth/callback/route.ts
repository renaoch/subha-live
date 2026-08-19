import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  console.log("OAUTH CALLBACK URL:", request.url);
  console.log("OAUTH CODE EXISTS:", !!code);

  if (!code) {
    console.error("OAUTH CALLBACK: NO CODE");

    return NextResponse.redirect(
      new URL("/auth?error=no_code", url.origin),
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(name, value, options);
              },
            );
          } catch {}
        },
      },
    },
  );

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  console.log("OAUTH EXCHANGE ERROR:", error);
  console.log("OAUTH SESSION CREATED:", !!data.session);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/auth?error=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(
    new URL("/home", url.origin),
  );
}