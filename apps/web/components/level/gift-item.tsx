"use client";

import { Gift, User, Crown, Sparkles, Heart, Star, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface GiftItemProps {
  id: string;
  senderName: string;
  senderAvatar?: string | null;
  giftName: string;
  giftIcon?: string;
  value: number;
  timestamp: string;
  isIncoming: boolean;
  level?: number;
}

const giftIcons = {
  heart: Heart,
  star: Star,
  crown: Crown,
  sparkles: Sparkles,
  gift: Gift,
};

export function GiftItem({
  senderName,
  senderAvatar,
  giftName,
  giftIcon = "gift",
  value,
  timestamp,
  isIncoming,
  level,
}: GiftItemProps) {
  const IconComponent = giftIcons[giftIcon as keyof typeof giftIcons] || Gift;

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-violet-400/20 hover:bg-white/[0.04]">
      {/* Avatar/Icon */}
      <div className="relative shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-400/20 to-amber-400/10">
          {senderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={senderAvatar}
              alt={senderName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <User className="h-5 w-5 text-white/30" />
          )}
        </div>
        {isIncoming ? (
          <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-400/20 p-0.5">
            <ArrowDownLeft className="h-3 w-3 text-emerald-300" />
          </div>
        ) : (
          <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-400/20 p-0.5">
            <ArrowUpRight className="h-3 w-3 text-amber-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-white">{senderName}</p>
          {level && (
            <span className="rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[8px] font-black text-violet-300">
              Lv.{level}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-white/40">{giftName}</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
            <Sparkles className="h-3 w-3" />
            {value.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="shrink-0 text-[10px] text-white/20">
        {new Date(timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </div>
    </div>
  );
}