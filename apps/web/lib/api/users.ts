import { apiFetch } from "@/lib/api/client";
import type { PrivateProfile, PublicProfile } from "@/lib/types";

export interface UpdateProfileInput {
  name?: string;
  handle?: string;
  avatar?: string;
  bio?: string;
  country?: string;
  country_flag?: string;
  gender?: string | null;
}

interface PrivateProfileResponse {
  status: string;
  user: PrivateProfile;
}

interface PublicProfileResponse {
  status: string;
  user: PublicProfile;
}

export const usersApi = {
  async me(): Promise<PrivateProfile> {
    const response = await apiFetch<PrivateProfileResponse>(
      "/api/v1/users/me",
    );

    return response.user;
  },

  async getById(id: string): Promise<PublicProfile> {
    const response = await apiFetch<PublicProfileResponse>(
      `/api/v1/users/${id}`,
    );

    return response.user;
  },

  /**
   * Only send the fields that actually changed — every field on
   * updateMyProfileSchema is optional, and the endpoint is .strict(),
   * so partial payloads are exactly what the backend expects.
   */
  async updateMe(input: UpdateProfileInput): Promise<PrivateProfile> {
    const response = await apiFetch<PrivateProfileResponse>(
      "/api/v1/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.user;
  },
};