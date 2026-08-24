import { apiFetch } from "@/lib/api/client";

import type {
  PrivateProfile,
  PublicProfile,
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

export interface FollowListEntry {
  id: string;
  public_id: string;
  name: string | null;
  handle: string | null;
  avatar: string | null;
  is_verified: boolean;
  level: number;
}

interface PrivateProfileResponse {
  status: string;
  user: PrivateProfile;
}

interface PublicProfileResponse {
  status: string;
  user: PublicProfile;
}

interface FollowListResponse {
  status: string;
  users: FollowListEntry[];
}

export const usersApi = {
  async me(): Promise<PrivateProfile> {
    const response =
      await apiFetch<PrivateProfileResponse>(
        "/api/v1/users/me",
      );

    return response.user;
  },

  async getById(
    id: string,
  ): Promise<PublicProfile> {
    const response =
      await apiFetch<PublicProfileResponse>(
        `/api/v1/users/${id}`,
      );

    return response.user;
  },

  async updateMe(
    input: UpdateProfileInput,
  ): Promise<PrivateProfile> {
    const response =
      await apiFetch<PrivateProfileResponse>(
        "/api/v1/users/me",
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      );

    return response.user;
  },

  async getFollowers(
    id: string,
  ): Promise<FollowListEntry[]> {
    const response =
      await apiFetch<FollowListResponse>(
        `/api/v1/users/${id}/followers`,
      );

    return response.users ?? [];
  },

  async getFollowing(
    id: string,
  ): Promise<FollowListEntry[]> {
    const response =
      await apiFetch<FollowListResponse>(
        `/api/v1/users/${id}/following`,
      );

    return response.users ?? [];
  },
};