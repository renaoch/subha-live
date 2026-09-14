// File: apps/web/lib/gift-image.ts
//
// Builds public URLs for gift artwork stored in the Supabase Storage
// "gift-image" bucket (Storage > Buckets > gift-image in the dashboard).
//
// The uploaded files are named positionally — gift-1.png .. gift-10.png —
// matching the gift catalog's display order (server returns gifts sorted
// by coin_price ascending, see getActiveGiftCatalog). So "gift-1" is the
// cheapest gift, "gift-2" the next, and so on. We also keep the gift's
// `code`/`icon` slug as fallback candidates in case a gift is renamed,
// reordered, or a new one is added without a matching gift-N upload.

const BUCKET = "gift-image";
const EXTENSIONS = ["png", "webp", "jpg", "gif"];

function supabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

function urlsFor(base: string, slug: string): string[] {
  return EXTENSIONS.map((ext) => `${base}/storage/v1/object/public/${BUCKET}/${slug}.${ext}`);
}

/**
 * Returns the ordered list of candidate public URLs for a gift's image.
 * `position` is the gift's 0-based index within the catalog list (as
 * returned by financialApi.giftCatalog(), sorted by coin_price) and maps
 * to the "gift-N.ext" files (1-based). The caller should render the
 * first URL and fall through to the next on load error, finally falling
 * back to the lucide icon if every candidate 404s.
 */
export function giftImageCandidates(
  gift: { code?: string; icon?: string },
  position?: number,
): string[] {
  const base = supabaseUrl();
  if (!base) return [];

  const urls: string[] = [];

  if (position !== undefined && position >= 0) {
    urls.push(...urlsFor(base, `gift-${position + 1}`));
  }

  const slugs = [gift.code, gift.icon].filter(
    (slug): slug is string => !!slug && slug.trim().length > 0,
  );
  for (const slug of slugs) {
    urls.push(...urlsFor(base, slug));
  }

  return urls;
}
