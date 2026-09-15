// components/WalletBalancePill.tsx
"use client";

import { useEffect, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import Link from "next/link";
import { usersApi } from "@/lib/api/users";
import { cn } from "@/lib/utils";

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface WalletBalancePillProps {
  className?: string;
  /**
   * Bump this (e.g. after sending a gift) to force a re-fetch of the
   * authoritative balance from the server. Never pass a locally-computed
   * balance in — this component only ever trusts usersApi.me().
   */
  refreshToken?: number;
}

/**
 * A small always-visible "how much money do I have" pill for viewers,
 * so the balance isn't only discoverable by opening the gift sheet.
 * Tapping it goes to the full wallet/recharge page.
 *
 * Always reads from GET /api/v1/users/me — the same authoritative source
 * every other balance display in the app uses — never derives a number
 * from client-side arithmetic.
 */
export function WalletBalancePill({ className, refreshToken }: WalletBalancePillProps) {
  const [coins, setCoins] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .me()
      .then((user) => {
        if (!cancelled) setCoins(user.coins ?? 0);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  if (failed) return null;

  return (
    <Link
      href="/wallet"
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-[#F5B93F]/30 bg-black/45 px-2.5 py-1.5 backdrop-blur-sm transition hover:bg-black/60 active:scale-95",
        className,
      )}
      aria-label="Your coin balance — open wallet"
    >
      <Coins className="h-3.5 w-3.5 text-[#F5B93F]" />
      <span className="text-xs font-bold leading-none text-white">
        {coins === null ? <Loader2 className="h-3 w-3 animate-spin" /> : formatCompact(coins)}
      </span>
    </Link>
  );
}
