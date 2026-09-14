// components/GiftImage.tsx
"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { giftImageCandidates } from "@/lib/gift-image";

interface GiftImageProps {
  gift: { code?: string; icon?: string };
  fallbackIcon: LucideIcon;
  /** 0-based index of this gift within the catalog list (maps to gift-N.png). */
  position?: number;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the gift's artwork from the Supabase "gift-image" storage
 * bucket (files named gift-1.png .. gift-10.png by catalog position).
 * Tries each candidate URL in order; if all of them fail to load (e.g.
 * no image uploaded yet for that slot), falls back to the lucide icon
 * that used to be the only visual for gifts.
 */
export function GiftImage({ gift, fallbackIcon: Icon, position, className, imgClassName }: GiftImageProps) {
  const [candidates] = useState(() => giftImageCandidates(gift, position));
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
