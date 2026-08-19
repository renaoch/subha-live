import { apiFetch } from "@/lib/api/client";
import type { Profile } from "@/lib/types";

// apps/api users.controller returns { status: "ok", user } — different
// envelope than /rooms. Normalized here so components only see `Profile`.
interface UserEnvelope {
  status: string;
  user: Profile;
}

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
  me() {
    return apiFetch<UserEnvelope>("/users/me").then((r) => r.user);
  },

  publicProfile(id: string) {
    return apiFetch<UserEnvelope>(`/users/${id}`).then((r) => r.user);
  },

  updateMe(input: UpdateProfileInput) {
    return apiFetch<UserEnvelope>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((r) => r.user);
  },
};