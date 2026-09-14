// components/GiftImage.tsx
"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { giftImageCandidates } from "@/lib/gift-image";

interface GiftImageProps {
  gift: { code?: string; icon?: string };
  fallbackIcon: LucideIcon;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the gift's artwork from the Supabase "gift-image" storage
 * bucket. Tries each candidate URL (by code, then icon slug, across a
 * few common extensions) in order; if all of them fail to load (e.g. no
 * image has been uploaded yet for that gift), falls back to the lucide
 * icon that used to be the only visual for gifts.
 */
export function GiftImage({ gift, fallbackIcon: Icon, className, imgClassName }: GiftImageProps) {
  const [candidates] = useState(() => giftImageCandidates(gift));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const src = candidates[index];

  if (!src) {
    return (
      <div className={className}>
        <Icon className={imgClassName} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL */}
      <img
        src={src}
        alt=""
        className={imgClassName}
        draggable={false}
        onError={() => setIndex((i) => i + 1)}
      />
    </div>
  );
}
