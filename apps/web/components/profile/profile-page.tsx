"use client";

import { useEffect, useState } from "react";

import { usersApi, FOLLOW_CHANGED_EVENT } from "@/lib/api/users";
import type { PrivateProfile } from "@/lib/types";

import { ProfileHero } from "./profile-hero";
import { ProfileVip } from "./profile-vip";
import { ProfileWallet } from "./profile-wallet";
import { ProfileMenu } from "./profile-menu";
import { ProfileSupport } from "./profile-support";
import { ProfileLogout } from "./profile-logout";
import { ProfileLoading } from "./profile-loading";
import { ProfileError } from "./profile-error";

export function ProfilePage() {
  const [profile, setProfile] =
    useState<PrivateProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const user = await usersApi.me();

        if (!cancelled) {
          setProfile(user);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // Following/followers/friends counts change the moment you follow or
  // unfollow someone anywhere in the app — refetch quietly (no loading
  // flash) so they update here in real time instead of only on remount.
  useEffect(() => {
    let cancelled = false;

    function refetchQuietly() {
      usersApi
        .me()
        .then((user) => {
          if (!cancelled) setProfile(user);
        })
        .catch(() => {
          // Keep showing the last known-good profile on a transient failure.
        });
    }

    window.addEventListener(FOLLOW_CHANGED_EVENT, refetchQuietly);
    return () => {
      cancelled = true;
      window.removeEventListener(FOLLOW_CHANGED_EVENT, refetchQuietly);
    };
  }, []);

  if (loading) {
    return <ProfileLoading />;
  }

  if (error || !profile) {
    return (
      <ProfileError
        message={
          error ??
          "Unable to load profile."
        }
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        <ProfileHero profile={profile} />

        <ProfileVip
          isVip={
            profile.svip ||
            profile.vip_level > 0
          }
        />

        <ProfileWallet
          coins={profile.coins}
          diamonds={profile.diamonds}
        />

        <ProfileMenu />

        <ProfileSupport />

        <ProfileLogout />
      </div>
    </main>
  );
}