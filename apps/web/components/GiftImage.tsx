// components/GiftImage.tsx
"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { getCachedGiftImage, resolveGiftImage } from "@/lib/gift-image-cache";

interface GiftImageProps {
  gift: { code?: string; icon?: string };
  fallbackIcon: LucideIcon;
  /** 0-based index of this gift within the catalog list (maps to gift-N.png). */
  position?: number;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the gift's artwork from the Supabase "gift-image" storage bucket.
 *
 * The working URL is resolved once and cached (memory + localStorage, see
 * lib/gift-image-cache.ts), and the whole catalog is preloaded when a room
 * opens — so on a cache hit this renders the finished <img> on the very first
 * paint, with no probing and no flash of the fallback icon. Only a genuine
 * first-ever miss falls back to the lucide icon while it resolves.
 */
export function GiftImage({ gift, fallbackIcon: Icon, position, className, imgClassName }: GiftImageProps) {
  const [src, setSrc] = useState<string | null | undefined>(() => getCachedGiftImage(gift, position));

  useEffect(() => {
    if (src) return;
    let cancelled = false;
    void resolveGiftImage(gift, position).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gift.code, gift.icon, position]);

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
        decoding="async"
        onError={() => setSrc(null)}
      />
    </div>
  );
}