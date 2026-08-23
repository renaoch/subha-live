import { createClient } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class AvatarUploadError extends Error {}

/**
 * Uploads an image file to the public `avatars` Supabase Storage bucket
 * under a per-user folder, and returns its public URL.
 *
 * Path shape: `{userId}/{timestamp}.{ext}` — the bucket's RLS policies
 * (see supabase/migrations/*_avatars_storage_bucket.sql) only allow a user
 * to write inside their own `{userId}/` folder.
 */
export async function uploadAvatar(
  file: File,
  userId: string,
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AvatarUploadError(
      "Please choose a JPG, PNG, WEBP, or GIF image.",
    );
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new AvatarUploadError("Image must be smaller than 5MB.");
  }

  const supabase = createClient();

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new AvatarUploadError(
      uploadError.message || "Failed to upload avatar.",
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return publicUrl;
}