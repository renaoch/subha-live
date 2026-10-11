import { apiFetch } from "@/lib/api/client";
import type { BanInfo } from "@/lib/ban-store";

export const moderationApi = {
  /** The one call a banned account is still allowed to make. */
  myBan() {
    return apiFetch<{ success: boolean; data: { banned: boolean; ban: BanInfo | null; serverNow: string } }>(
      "/api/v1/moderation/me/ban",
    ).then((r) => r.data);
  },
};
