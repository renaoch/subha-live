"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      setEmail(user.email ?? null);
      setLoading(false);
    }

    loadUser();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold">
          Welcome to Subha
        </h1>

        <p className="mt-2 text-muted-foreground">
          You are signed in as {email}
        </p>
      </div>
    </main>
  );
}