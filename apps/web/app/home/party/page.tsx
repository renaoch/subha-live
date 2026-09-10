"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Swords,
  Gamepad2,
  CalendarClock,
  ChevronRight,
  Users,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useRooms } from "@/hooks/queries/use-rooms";
import { useActivePkBattles } from "@/hooks/queries/use-pk";
import type { RoomRecord } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

// Party = "what interactive activity can I participate in?" — a discovery
// surface for PK battles, party games, and events. It reuses the same room
// data/infra as Home, but never lists plain rooms; every card here routes
// into the *activity* context of the existing live-room route
// (`/home/room/[id]`), same as Home does. See app/home/page.tsx for the
// "what's live right now" counterpart.

const GAMES = [
  {
    id: "quiz",
    name: "Quiz",
    description: "Live multiplayer trivia with rounds and a leaderboard.",
    available: false,
  },
  {
    id: "truth-or-dare",
    name: "Truth or Dare",
    description: "Classic party game for the room.",
    available: false,
  },
  {
    id: "guess-the-word",
    name: "Guess the Word",
    description: "One player draws or describes, everyone else guesses.",
    available: false,
  },
  {
    id: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    description: "Quick 1v1 duels between room guests.",
    available: false,
  },
] as const;

export default function PartyPage() {
  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsError,
    refetch: refetchRooms,
  } = useRooms();
  const {
    data: battles,
    isLoading: battlesLoading,
    isError: battlesError,
    refetch: refetchBattles,
  } = useActivePkBattles();

  const roomsById = useMemo(() => {
    const map = new Map<string, RoomRecord>();
    for (const room of rooms ?? []) map.set(room.id, room);
    return map;
  }, [rooms]);

  const liveRooms = useMemo(
    () => (rooms ?? []).filter((r) => r.status === "live"),
    [rooms],
  );

  // "Featured activity": prefer an active PK battle (highest-energy activity),
  // fall back to the most-watched live room so the hero is never empty.
  const featuredBattle = battles?.[0];
  const featuredRoom = liveRooms.length
    ? [...liveRooms].sort(
        (a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0),
      )[0]
    : undefined;

  const loading = roomsLoading || battlesLoading;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[680px] bg-surface pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/90 px-4 pb-3 pt-5 backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Subha Live
        </p>
        <h1 className="mt-0.5 font-display text-[1.7rem] font-bold tracking-[-0.04em] text-ink">
          Party
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Join a PK battle, play a game, or catch a live event.
        </p>
      </header>

      <section className="px-4 pt-5">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Party…
            </div>
          </div>
        ) : (
          <>
            <FeaturedActivity battle={featuredBattle} room={featuredRoom} roomsById={roomsById} />

            <PkSection
              battles={battles}
              error={battlesError}
              roomsById={roomsById}
              onRetry={() => refetchBattles()}
            />

            <GamesSection />

            <EventsSection />
          </>
        )}

        {roomsError && !loading && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface-raised p-3 text-xs text-ink-muted">
            Some activity data couldn't load.
            <button
              onClick={() => refetchRooms()}
              className="flex items-center gap-1 font-semibold text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function FeaturedActivity({
  battle,
  room,
  roomsById,
}: {
  battle?: { id: string; room_a_id: string; room_b_id: string; status: string };
  room?: RoomRecord;
  roomsById: Map<string, RoomRecord>;
}) {
  if (battle) {
    const roomA = roomsById.get(battle.room_a_id);
    const roomB = roomsById.get(battle.room_b_id);
    return (
      <Link
        href={`/home/room/${battle.room_a_id}`}
        className="relative block overflow-hidden rounded-[24px] bg-gradient-to-br from-accent-hot to-accent px-5 py-6 text-white shadow-panel"
      >
        <Swords className="absolute -right-3 -top-3 h-24 w-24 text-white/15" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
          Featured · PK Battle
        </p>
        <p className="mt-1 font-display text-2xl font-bold">
          {roomA?.host?.name ?? "Host"} vs {roomB?.host?.name ?? "Host"}
        </p>
        <p className="mt-1 text-sm text-white/85">
          Tap in to watch the battle live
        </p>
      </Link>
    );
  }

  if (room) {
    return (
      <Link
        href={`/home/room/${room.id}`}
        className="relative block overflow-hidden rounded-[24px] bg-gradient-to-br from-accent to-accent-hot px-5 py-6 text-white shadow-panel"
      >
        <Sparkles className="absolute -right-3 -top-3 h-24 w-24 text-white/15" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
          Featured · Trending host
        </p>
        <p className="mt-1 font-display text-2xl font-bold">
          {room.host?.name ?? "Subha host"}
        </p>
        <p className="mt-1 truncate text-sm text-white/85">{room.title}</p>
      </Link>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-border bg-surface-raised px-5 py-6 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-ink-muted" />
      <p className="mt-2 text-sm font-semibold text-ink">
        Nothing featured right now
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Start a PK battle or go live to be featured here.
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Swords;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-ink" />
        <h2 className="text-base font-bold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function PkSection({
  battles,
  error,
  roomsById,
  onRetry,
}: {
  battles?: Array<{ id: string; room_a_id: string; room_b_id: string; status: string; score_a: number; score_b: number }>;
  error: boolean;
  roomsById: Map<string, RoomRecord>;
  onRetry: () => void;
}) {
  return (
    <section>
      <SectionHeader
        icon={Swords}
        title="PK Battles"
        action={
          <span className="text-xs font-medium text-ink-muted">
            {battles?.length ?? 0} active
          </span>
        }
      />

      {error ? (
        <button
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface-raised p-4 text-xs font-semibold text-ink-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Couldn't load PK battles — tap to retry
        </button>
      ) : !battles || battles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-ink-muted">
          No PK battles right now. Start one from inside a live room.
        </div>
      ) : (
        <div className="space-y-2.5">
          {battles.map((battle) => {
            const roomA = roomsById.get(battle.room_a_id);
            const roomB = roomsById.get(battle.room_b_id);
            const isLive = battle.status === "ACTIVE";
            return (
              <Link
                key={battle.id}
                href={`/home/room/${battle.room_a_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 shadow-sm transition-colors hover:border-accent/40"
              >
                <div className="flex -space-x-3">
                  <Avatar
                    name={roomA?.host?.name ?? "Host A"}
                    src={roomA?.host?.avatar ?? undefined}
                    size="sm"
                    className="ring-2 ring-surface-raised"
                  />
                  <Avatar
                    name={roomB?.host?.name ?? "Host B"}
                    src={roomB?.host?.avatar ?? undefined}
                    size="sm"
                    className="ring-2 ring-surface-raised"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {roomA?.host?.name ?? "Host A"} vs{" "}
                    {roomB?.host?.name ?? "Host B"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {isLive
                      ? `${battle.score_a} — ${battle.score_b}`
                      : battle.status === "INVITED"
                        ? "Invitation pending"
                        : "Starting soon"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                    isLive
                      ? "bg-accent-hot/15 text-accent-hot"
                      : "bg-surface text-ink-muted",
                  )}
                >
                  {isLive ? "LIVE" : battle.status}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GamesSection() {
  return (
    <section>
      <SectionHeader icon={Gamepad2} title="Games" />
      <div className="grid grid-cols-2 gap-2.5">
        {GAMES.map((game) =>
          game.available ? (
            <Link
              key={game.id}
              href={`/home/party/games/${game.id}`}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-3.5 text-left shadow-sm transition-colors hover:border-accent/40"
            >
              <p className="text-sm font-bold text-ink">{game.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                {game.description}
              </p>
              <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                Play now
              </span>
            </Link>
          ) : (
            <div
              key={game.id}
              className="flex flex-col justify-between rounded-2xl border border-dashed border-border bg-surface-raised/60 p-3.5 text-left opacity-70"
            >
              <p className="text-sm font-bold text-ink">{game.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                {game.description}
              </p>
              <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                Coming soon
              </span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function EventsSection() {
  return (
    <section>
      <SectionHeader icon={CalendarClock} title="Events" />
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-ink-muted">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-ink">
            Scheduled events are coming soon
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            We'll surface hosted events and special activities here.
          </p>
        </div>
      </div>
    </section>
  );
}