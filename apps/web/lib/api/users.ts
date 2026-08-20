import { apiFetch } from "@/lib/api/client";

import type {
  PrivateProfile,
  PrivateProfileResponse,
  PublicProfile,
  PublicProfileResponse,
} from "@/lib/types";

export interface UpdateProfileInput {
  name?: string;
  handle?: string;
  avatar?: string;
  bio?: string;
  country?: string;
  country_flag?: string;
  gender?: string | null;
}

export const usersApi = {
  // ---------------------------------------------------------------------------
  // Private profile
  // GET /api/v1/users/me
  // ---------------------------------------------------------------------------

  me(): Promise<PrivateProfile> {
    return apiFetch<PrivateProfileResponse>(
      "/api/v1/users/me",
    ).then((response) => response.user);
  },

  // ---------------------------------------------------------------------------
  // Public profile
  // GET /api/v1/users/:id
  // ---------------------------------------------------------------------------

  publicProfile(
    id: string,
  ): Promise<PublicProfile> {
    return apiFetch<PublicProfileResponse>(
      `/api/v1/users/${encodeURIComponent(id)}`,
    ).then((response) => response.user);
  },

  // ---------------------------------------------------------------------------
  // Update private profile
  // PATCH /api/v1/users/me
  // ---------------------------------------------------------------------------

  updateMe(
    input: UpdateProfileInput,
  ): Promise<PrivateProfile> {
    return apiFetch<PrivateProfileResponse>(
      "/api/v1/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    ).then((response) => response.user);
  },
};