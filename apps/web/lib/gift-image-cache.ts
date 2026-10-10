// lib/gift-image-cache.ts
//
// Makes gift artwork appear instantly.
//
// Two things used to make gift images slow:
//   1. A gift's art is looked up by trying gift-N.png, then .webp, .jpg, .gif,
//      then the same for its code and icon slug — every miss is a network 404
//      the user waits through, and it was repeated for every row and every mount.
//   2. Nothing warmed the images up, so the first gift row in a room had to
//      download its art after it was already on screen.
//
// This module fixes both:
//   - It remembers which URL actually works for a gift (in memory, and in
//     localStorage so the next visit skips the probing completely).
//   - `preloadGiftImages` downloads and decodes the whole catalog once when a
//     room opens and keeps the <img> objects alive, so the browser serves them
//     from memory the moment a gift row renders.
//   - Failed candidates are remembered, so a missing file is never re-requested.

import { giftImageCandidates } from "@/lib/gift-image";

const STORAGE_KEY = "gift-img-url-v1";

/** slug (gift-N, code or icon) -> the URL that loaded successfully. */
const resolved = new Map<string, string>();
/** URLs that failed to load; never retried this session. */
const failed = new Set<string>();
/** In-flight resolutions, so concurrent callers share one probe. */
const inflight = new Map<string, Promise<string | null>>();
/** Keeps decoded images alive so the browser doesn't evict them. */
const pinned = new Map<string, HTMLImageElement>();

let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [slug, url] of Object.entries(obj)) {
      if (typeof url === "string") resolved.set(slug, url);
    }
  } catch {
    /* storage unavailable or corrupt — just start empty */
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(resolved)));
  } catch {
    /* quota / private mode — in-memory cache still works */
  }
}

type GiftLike = { code?: string; icon?: string };

function slugsFor(gift: GiftLike, position?: number): string[] {
  const out: string[] = [];
  if (position !== undefined && position >= 0) out.push(`gift-${position + 1}`);
  if (gift.code?.trim()) out.push(gift.code.trim());
  if (gift.icon?.trim()) out.push(gift.icon.trim());
  return out;
}

/** The known-good URL for this gift, if we already have one. Synchronous. */
export function getCachedGiftImage(gift: GiftLike, position?: number): string | undefined {
  hydrate();
  for (const slug of slugsFor(gift, position)) {
    const url = resolved.get(slug);
    if (url) return url;
  }
  return undefined;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // decode() makes the first paint instant; ignore if unsupported.
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(img));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Finds (and warms) the first candidate URL that really loads. Resolves null
 * when none do, so the caller can show the fallback icon.
 */
export function resolveGiftImage(gift: GiftLike, position?: number): Promise<string | null> {
  const cached = getCachedGiftImage(gift, position);
  if (cached) return Promise.resolve(cached);

  const key = slugsFor(gift, position).join("|");
  if (!key) return Promise.resolve(null);
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    for (const url of giftImageCandidates(gift, position)) {
      if (failed.has(url)) continue;
      const img = await loadImage(url);
      if (!img) {
        failed.add(url);
        continue;
      }
      pinned.set(url, img);
      // Alias the winner under every slug so a chat row (code only) and the
      // picker (position) both hit the same entry.
      for (const slug of slugsFor(gift, position)) resolved.set(slug, url);
      persist();
      return url;
    }
    return null;
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/**
 * Warm the whole catalog. `gifts` must be in catalog order (the order the
 * picker uses) so positional gift-N files line up. Safe to call repeatedly.
 */
export function preloadGiftImages(gifts: Array<GiftLike>): void {
  hydrate();
  gifts.forEach((gift, position) => {
    void resolveGiftImage(gift, position);
  });
}