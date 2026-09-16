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
      color: "#CBA35C",
    },
    {
      label: "Diamonds",
      value: diamonds,
      color: "#D98FA0",
    },
  ];

  return (
    <div className="space-y-2">
      <Link
        href="/wallet"
        className="grid grid-cols-2 gap-3"
        aria-label="Open wallet"
      >
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-4 py-3.5 transition hover:border-[#CBA35C]/50 active:scale-[0.98]"
          >
            <p className="text-xs text-[#9088A0]">
              {item.label}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: item.color,
                }}
                aria-hidden="true"
              />

              {numberFormat.format(item.value)}
            </p>
          </div>
        ))}
      </Link>

      <Link
        href="/wallet"
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#CBA35C] text-sm font-bold text-[#17131F] transition hover:bg-[#DDBA78] active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> Recharge
      </Link>
    </div>
  );
}