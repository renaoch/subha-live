"use client";

import { Gift } from "lucide-react";
import { GiftItem } from "./gift-item";

export interface GiftData {
  id: string;
  senderName: string;
  senderAvatar?: string | null;
  senderLevel?: number;
  giftName: string;
  giftIcon?: string;
  value: number;
  timestamp: string;
}

interface GiftListProps {
  gifts: GiftData[];
  isIncoming: boolean;
  loading?: boolean;
}

export function GiftList({ gifts, isIncoming, loading = false }: GiftListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  if (gifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/8 bg-white/[0.015] px-6 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400/20 to-amber-400/10 blur-2xl" />
          <Gift className="relative h-12 w-12 text-white/15" />
        </div>
        <h3 className="mt-4 text-sm font-black text-white/40">
          No {isIncoming ? "incoming" : "outgoing"} gifts
        </h3>
        <p className="mt-1 text-xs text-white/20">
          {isIncoming
            ? "Gifts you receive will appear here"
            : "Gifts you send will appear here"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gifts.map((gift) => (
        <GiftItem
          key={gift.id}
          id={gift.id}
          senderName={gift.senderName}
          senderAvatar={gift.senderAvatar}
          level={gift.senderLevel}
          giftName={gift.giftName}
          giftIcon={gift.giftIcon}
          value={gift.value}
          timestamp={gift.timestamp}
          isIncoming={isIncoming}
        />
      ))}
    </div>
  );
}