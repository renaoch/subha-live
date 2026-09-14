// File: apps/web/lib/gift-image.ts
//
// Builds public URLs for gift artwork stored in the Supabase Storage
// "gift-image" bucket (Storage > Buckets > gift-image in the dashboard).
//
// Convention: each gift's image is stored as `${code}.png` (falling back
// to `${icon}.png` for older rows), e.g. a gift with code "rose" maps to
// gift-image/rose.png. Upload files using the gift's `code` as the file
// name (extension can be .png, .jpg, .webp, or .gif — all are tried).

const BUCKET = "gift-image";
const EXTENSIONS = ["png", "webp", "jpg", "gif"];

function supabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Returns the ordered list of candidate public URLs for a gift's image,
 * keyed first by its catalog `code` and then by its `icon` (some older
 * catalog rows only have an icon slug). The caller should render the
 * first URL and fall through to the next on load error, finally falling
 * back to the lucide icon if every candidate 404s.
 */
export function giftImageCandidates(gift: { code?: string; icon?: string }): string[] {
  const base = supabaseUrl();
  if (!base) return [];

  const slugs = [gift.code, gift.icon].filter(
    (slug): slug is string => !!slug && slug.trim().length > 0,
  );

  const urls: string[] = [];
  for (const slug of slugs) {
    for (const ext of EXTENSIONS) {
      urls.push(`${base}/storage/v1/object/public/${BUCKET}/${slug}.${ext}`);
    }
  }
  return urls;
}
