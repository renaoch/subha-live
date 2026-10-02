"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the error-reporting channel without exposing the raw error to users.
    console.error("[room] render error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[100svh] w-full items-center justify-center bg-black px-6 text-center text-white">
      <div>
        <p className="text-lg font-bold">Something went wrong in this room</p>
        <p className="mt-1 text-sm text-white/60">
          The room hit an unexpected error. You can retry or head back home.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
