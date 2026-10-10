// components/RoomHeader.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ClipboardList, Plus, Star, User, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usersApi } from "@/lib/api/users";
import { HostTaskCard } from "@/components/HostTaskCard";
import { ExplorePill, MoreDotsButton, TopRankPill } from "@/components/room/hud/RoomPills";
import type { HostTaskStats, ViewerHostTask } from "@/lib/api/host-task";
import type { RoomOverview } from "@/lib/api/room-overview";

interface RoomHeaderHost {
  id?: string;
  name?: string | null;
  avatar?: string | null;
  role?: string | null;
  is_verified?: boolean | null;
  is_admin?: boolean | null;
  level?: number | null;
  public_id?: string | null;
}

interface RoomHeaderProps {
  host?: RoomHeaderHost | null;
  viewerCount: number;
  isLive: boolean;
  onLeave: () => void;
  /** Explore pill: keep this room alive in the mini player and open the room list. */
  onExplore?: () => void;
  /** Opens the "more" sheet (share, levels, camera…). */
  onOpenMore?: () => void;
  currentUserId?: string | null;
  /** Real header data: host public ID, today's top gifters, host rank. */
  overview?: RoomOverview | null;
  task?: ViewerHostTask | null;
  isHost?: boolean;
  onClaimTask?: () => void;
  claimingTask?: boolean;
  taskStats?: HostTaskStats | null;
  /** Host only: opens the tabbed Host Task Center. */
  onOpenHostTasks?: () => void;
  /** Host only: number of completed-but-unclaimed tasks (red dot). */
  hostTaskBadge?: number;
  onOpenViewers?: () => void;
  /** Tapping the top-3 avatars opens the full contributors leaderboard. */
  onOpenContributors?: () => void;
  onOpenProfile?: (userId: string) => void;
  /** Small status chip rendered in the pill row (host: LIVE / CONNECTING). */
  statusChip?: ReactNode;
  /** Cards rendered under the pill row (Star Target, Regional Challenge…). */
  cards?: ReactNode;
  /** Anything that should flow under the cards (e.g. "Last PK" card). */
  footer?: ReactNode;
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** Follow / Following toggle with optimistic UI and rollback. */
function FollowButton({ hostId }: { hostId: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getFollowStatus(hostId)
      .then((s) => !cancelled && setFollowing(Boolean(s.following)))
      .catch(() => !cancelled && setFollowing(false));
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  const toggle = async () => {
    if (pending || following === null) return;
    const next = !following;
    setFollowing(next);
    setPending(true);
    try {
      if (next) await usersApi.follow(hostId);
      else await usersApi.unfollow(hostId);
    } catch {
      setFollowing(!next);
    } finally {
      setPending(false);
    }
  };

  if (following === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-bold leading-none text-white transition active:scale-95 disabled:opacity-60",
        following ? "bg-white/15 backdrop-blur-sm" : "shadow-[0_4px_16px_rgba(255,40,100,0.45)]",
      )}
      style={
        following ? undefined : { background: "linear-gradient(135deg,#ff4d8d 0%,#ff1f5a 100%)" }
      }
    >
      {!following && <Plus className="h-4 w-4" strokeWidth={2.6} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}

const RANK_RING: Record<number, string> = {
  1: "linear-gradient(135deg,#ffe28a,#f2a81d)",
  2: "linear-gradient(135deg,#d7e3f4,#8fa2bd)",
  3: "linear-gradient(135deg,#ffc79a,#c9783a)",
};

function TopGifters({
  list,
  onClick,
}: {
  list: RoomOverview["topContributors"];
  onClick?: () => void;
}) {
  if (list.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Top contributors"
      className="flex shrink-0 items-center -space-x-1.5 transition active:scale-95"
    >
      {list.slice(0, 3).map((c) => (
        <span key={c.userId} className="relative">
          {c.rank === 1 && (
            <svg
              viewBox="0 0 24 16"
              className="absolute -top-[11px] left-1/2 z-10 h-[13px] w-[19px] -translate-x-1/2"
              aria-hidden
            >
              <path
                d="M2 14 L1 4 L7 8 L12 1 L17 8 L23 4 L22 14 Z"
                fill="#ffc83d"
                stroke="#fff0b0"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span
            className="block rounded-full p-[2px]"
            style={{ background: RANK_RING[c.rank] ?? RANK_RING[3] }}
          >
            <Avatar
              name={c.name}
              src={c.avatar ?? undefined}
              size="sm"
              className="!h-[34px] !w-[34px] border border-black/60"
            />
          </span>
        </span>
      ))}
    </button>
  );
}

export function RoomHeader({
  host,
  viewerCount,
  isLive,
  onLeave,
  onExplore,
  onOpenMore,
  currentUserId,
  overview,
  task,
  isHost,
  onClaimTask,
  claimingTask,
  taskStats,
  onOpenHostTasks,
  hostTaskBadge,
  onOpenViewers,
  onOpenContributors,
  onOpenProfile,
  statusChip,
  cards,
  footer,
}: RoomHeaderProps) {
  const hostName = host?.name || "Host";
  const showFollow = Boolean(host?.id && host.id !== currentUserId);
  const publicId = overview?.host.publicId ?? host?.public_id ?? null;
  const verified = overview?.host.isVerified ?? Boolean(host?.is_verified);

  return (
    <div className="absolute inset-x-0 top-0 z-30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />

      <div className="relative flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
        {/* Host identity */}
        <button
          type="button"
          onClick={() => host?.id && onOpenProfile?.(host.id)}
          disabled={!host?.id}
          className="relative flex min-w-0 shrink items-center gap-2 text-left transition active:scale-[0.98] disabled:cursor-default"
        >
          <span className="relative shrink-0 pb-2">
            <span
              className="block rounded-full p-[2px]"
              style={{ background: "linear-gradient(135deg,#ff6aa5,#a65bff)" }}
            >
              <Avatar
                name={hostName}
                src={host?.avatar || undefined}
                size="md"
                online={isLive}
                className="!h-[48px] !w-[48px] border-2 border-black"
              />
            </span>
            <span
              className="absolute inset-x-1 bottom-0 rounded-full py-[1px] text-center text-[10px] font-bold leading-[13px] text-white"
              style={{ background: "linear-gradient(135deg,#ff4d8d,#ff1f5a)" }}
            >
              Host
            </span>
          </span>
          <span className="min-w-0 pb-1">
            <span className="flex items-center gap-1">
              <span className="truncate text-[17px] font-bold leading-tight text-white">{hostName}</span>
              {verified && <Star className="h-4 w-4 shrink-0 fill-[#ffc83d] text-[#ffc83d]" aria-label="Verified" />}
            </span>
            {publicId && (
              <span className="block truncate text-[12px] font-medium leading-tight text-white/75">
                ID: {publicId}
              </span>
            )}
          </span>
        </button>

        {showFollow && host?.id && <FollowButton hostId={host.id} />}

        {/* Right cluster */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <TopGifters list={overview?.topContributors ?? []} onClick={onOpenContributors} />
          <button
            type="button"
            onClick={onOpenViewers}
            disabled={!onOpenViewers}
            aria-label={`${formatCount(viewerCount)} viewers — view list`}
            className="flex items-center gap-1 rounded-full border border-[#5b7cff]/30 bg-[#0e1230]/60 px-2.5 py-1.5 text-[14px] font-semibold leading-none text-white backdrop-blur-xl transition enabled:active:scale-95"
          >
            <User className="h-3.5 w-3.5 text-white/80" strokeWidth={2.2} />
            {formatCount(viewerCount)}
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Close room"
            className="flex h-8 w-8 items-center justify-center text-white transition active:scale-90"
          >
            <X className="h-7 w-7" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Pill row: rank · (more) · status … explore */}
      <div className="relative mt-2.5 flex items-center gap-2 px-3">
        <TopRankPill rank={overview?.hostRank?.rank ?? null} />
        {onOpenMore && <MoreDotsButton onClick={onOpenMore} />}
        {statusChip}
        {isHost && onOpenHostTasks && (
          <button
            type="button"
            onClick={onOpenHostTasks}
            aria-label="Host tasks"
            className="relative flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-xl transition active:scale-95"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Tasks
            {!!hostTaskBadge && hostTaskBadge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black/60 bg-[#ff3b5c]" />
            )}
          </button>
        )}
        {onExplore && (
          <div className="ml-auto">
            <ExplorePill onClick={onExplore} />
          </div>
        )}
      </div>

      {cards && <div className="relative mt-3 px-3">{cards}</div>}

      <HostTaskCard
        task={task ?? null}
        isHost={isHost}
        onClaim={onClaimTask}
        claiming={claimingTask}
        stats={taskStats}
      />

      {footer && <div className="relative mt-2 px-3">{footer}</div>}
    </div>
  );
}