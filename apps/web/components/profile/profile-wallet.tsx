"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

const numberFormat = new Intl.NumberFormat("en-US");

interface ProfileWalletProps {
  coins: number;
  diamonds: number;
}

export function ProfileWallet({
  coins,
  diamonds,
}: ProfileWalletProps) {
  const items = [
    {
      label: "Coins",
      value: coins,
      color: "#F5C96A",
      href: "/wallet",
      aria: "Open Coins",
    },
    {
      label: "Diamonds",
      value: diamonds,
      color: "#FF7AB0",
      href: "/wallet/diamonds",
      aria: "Open Diamonds",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.aria}
            className="relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition active:scale-[0.98]"
            style={{ borderColor: `${item.color}55`, background: `linear-gradient(135deg, ${item.color}30, rgba(255,255,255,0.04) 70%)` }}
          >
            <p className="text-xs font-medium text-[#D9CFE6]">
              {item.label}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tabular-nums">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: item.color,
                  boxShadow: `0 0 10px ${item.color}`,
                }}
                aria-hidden="true"
              />

              {numberFormat.format(item.value)}
            </p>
          </Link>
        ))}
      </div>

      <Link
        href="/wallet"
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#FFE29A] via-[#F5C96A] to-[#E8A22E] text-sm font-extrabold text-[#2E1C04] shadow-[0_8px_26px_rgba(245,185,63,0.45)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> Recharge
      </Link>
    </div>
  );
}