// components/RoomHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usersApi } from "@/lib/api/users";
import {
  BadgeCheck,
  Crown,
  Users,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";

interface RoomHeaderHost {
  id?: string;
  name?: string | null;
  avatar?: string | null;
  role?: string | null;
  is_verified?: boolean | null;
  is_admin?: boolean | null;
  level?: number | null;
}

interface RoomHeaderProps {
  host?: RoomHeaderHost | null;
  viewerCount: number;
  isLive: boolean;
  onLeave: () => void;
  /** Currently logged-in user, so we can hide Follow on your own room. */
  currentUserId?: string | null;
}

type Tag = {
  label: string;
  Icon: typeof Crown;
  primary: string;
  accent: string;
};

/**
 * Role tag. Mirrors the badge set already used on the profile page
 * (see components/profile/profile-hero.tsx) so a host's tag looks the
 * same whether you're viewing their profile or their live room.
 */
function roleTag(role: string | null | undefined): Tag | null {
  switch (role) {
    case "agency_owner":
      return { label: "Agency Owner", Icon: Crown, primary: "#F5B93F", accent: "#FFE29E" };
    case "agency_admin":
    case "agency_agent":
      return { label: "Host Manager", Icon: UsersRound, primary: "#57C2FF", accent: "#B3E6FF" };
    case "agency_host":
      return { label: "Host", Icon: UsersRound, primary: "#5FD9C4", accent: "#B4F5E7" };
    default:
      return null;
  }
}

/** Platform admin/engineer tag — separate from agency role. */
function adminTag(isAdmin: boolean | null | undefined): Tag | null {
  if (!isAdmin) return null;
  return { label: "Engineer", Icon: Wrench, primary: "#A86CFF", accent: "#DCC2FF" };
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none"
      style={{
        color: tag.accent,
        borderColor: `${tag.primary}66`,
        background: `linear-gradient(135deg, ${tag.primary}33, ${tag.primary}0D)`,
      }}
    >
      <tag.Icon className="h-2.5 w-2.5" style={{ color: tag.primary }} />
      {tag.label}
    </span>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/**
 * Follow / Following toggle for the room host.
 *
 * - Fetches the initial follow status once, on mount.
 * - Follow -> unfilled pill, "Follow".
 * - Following -> filled/subdued pill, "Following"; tapping it unfollows.
 * - Optimistic UI: flips immediately on tap, rolls back if the request
 *   fails, so it doesn't feel laggy inside a live room.
 */
function FollowButton({ hostId }: { hostId: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    usersApi
      .getFollowStatus(hostId)
      .then((status) => {
        if (!cancelled) setFollowing(Boolean(status.following));
      })
      .catch(() => {
        if (!cancelled) setFollowing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hostId]);

  const handleToggle = async () => {
    if (pending || following === null) return;

    const next = !following;
    setFollowing(next);
    setPending(true);

    try {
      if (next) {
        await usersApi.follow(hostId);
      } else {
        await usersApi.unfollow(hostId);
      }
    } catch {
      // Roll back on failure.
      setFollowing(!next);
    } finally {
      setPending(false);
    }
  };

  // Don't render anything until we know the real status — avoids a
  // flash of the wrong label.
  if (following === null) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-bold leading-none transition active:scale-95 disabled:opacity-60",
        following
          ? "bg-white/15 text-white/80 backdrop-blur-sm hover:bg-white/20"
          : "bg-[#FF3B5C] text-white hover:bg-[#FF3B5C]/90",
      )}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function RoomHeader({
  host,
  viewerCount,
  isLive,
  onLeave,
  currentUserId,
}: RoomHeaderProps) {
  const hostName = host?.name || "Host";
  const avatarUrl = host?.avatar || undefined;

  const tags = [roleTag(host?.role), adminTag(host?.is_admin)].filter(
    (t): t is Tag => t !== null,
  );

  const showFollow = Boolean(host?.id && host.id !== currentUserId);

  return (
    <div className="absolute inset-x-0 top-0 z-30">
      {/* Legibility scrim: the header now carries more info (tags,
          two pills, avatar), so it needs a real gradient behind it
          rather than floating directly on top of the video. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />

      <div className="relative flex items-start justify-between gap-3 px-4 pt-10">
        {/* Left group: host identity + follow button, min-w-0 so the
            name truncates instead of pushing the right cluster off. */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={host?.id ? `/user/${host.id}` : "#"}
            className="flex min-w-0 items-center gap-2.5 rounded-full py-0.5 transition active:scale-[0.98]"
          >
            <Avatar
              name={hostName}
              src={avatarUrl}
              size="md"
              online={isLive}
              className="h-10 w-10 shrink-0 border-2 border-white/15"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-[15px] font-semibold leading-tight text-white">
                  {hostName}
                </p>
                {host?.is_verified && (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 fill-[#57C2FF] text-black"
                    aria-label="Verified"
                  />
                )}
              </div>

              {tags.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {tags.map((tag) => (
                    <TagPill key={tag.label} tag={tag} />
                  ))}
                </div>
              )}
            </div>
          </Link>

          {showFollow && host?.id && <FollowButton hostId={host.id} />}
        </div>

        {/* Right group: LIVE pill, viewer count, close */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-sm">
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-[#FF3B5C] px-2 py-0.5 text-[10px] font-black leading-none text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                LIVE
              </span>
            )}

            <span className="flex items-center gap-1 text-xs font-semibold leading-none text-white/90">
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              {formatCount(viewerCount)}
            </span>
          </div>

          <button
            type="button"
            onClick={onLeave}
            aria-label="Close room"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-black/45 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white",
            )}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}