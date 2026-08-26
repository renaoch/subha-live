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
  user?: PublicProfile;
}

interface FollowListResponse {
  status: string;
  users?: FollowListEntry[];
}

interface FollowStatusResponse {
  following?: boolean;
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
      `/api/v1/users/${encodeURIComponent(id)}`,
    );

    if (!response.user) {
      throw new Error("Profile not found");
    }

    return response.user;
  },

  async updateMe(
    input: UpdateProfileInput,
  ): Promise<PrivateProfile> {
    const response = await apiFetch<PrivateProfileResponse>(
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
    const response = await apiFetch<FollowListResponse>(
      `/api/v1/users/${encodeURIComponent(id)}/followers`,
    );

    return Array.isArray(response.users)
      ? response.users
      : [];
  },

  async getFollowing(
    id: string,
  ): Promise<FollowListEntry[]> {
    const response = await apiFetch<FollowListResponse>(
      `/api/v1/users/${encodeURIComponent(id)}/following`,
    );

    return Array.isArray(response.users)
      ? response.users
      : [];
  },

  async getFollowStatus(
    id: string,
  ): Promise<FollowStatusResponse> {
    return apiFetch<FollowStatusResponse>(
      `/api/v1/users/${encodeURIComponent(id)}/follow-status`,
    );
  },

  async follow(id: string) {
    return apiFetch(
      `/api/v1/users/${encodeURIComponent(id)}/follow`,
      {
        method: "POST",
      },
    );
  },

  async unfollow(id: string) {
    return apiFetch(
      `/api/v1/users/${encodeURIComponent(id)}/follow`,
      {
        method: "DELETE",
      },
    );
  },
};

export function mutualFriends(
  followers: FollowListEntry[],
  following: FollowListEntry[],
): FollowListEntry[] {
  const followingIds = new Set(
    following.map((user) => user.id),
  );

  return followers.filter((user) =>
    followingIds.has(user.id),
  );
}