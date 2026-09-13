"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Swords,
  Gamepad2,
  CalendarClock,
  ChevronRight,
  Users,
  Loader2,
  RotateCcw,
  PartyPopper,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useRooms, useCreateRoom } from "@/hooks/queries/use-rooms";
import { useActivePkBattles } from "@/hooks/queries/use-pk";
import type { RoomRecord } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

/** Audio party rooms created from "Go Party" always open with 10 seats. */
const PARTY_SEAT_COUNT = 10;

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
  const router = useRouter();
  const createRoomMutation = useCreateRoom();
  const [launching, setLaunching] = useState(false);

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

  async function goParty() {
    setLaunching(true);
    try {
      const room = await createRoomMutation.mutateAsync({
        title: "Party time 🎉",
        livekit_room_name: `subha-party-${crypto.randomUUID()}`,
        category: "explore",
        max_guest_slots: PARTY_SEAT_COUNT,
        media_type: "audio",
      });
      router.push(`/home/room/${room.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't start the party",
      );
      setLaunching(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[680px] bg-surface pb-10">
      <header className="glass-panel sticky top-0 z-30 rounded-none border-x-0 border-t-0 px-4 pb-3 pt-5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-hot">
          <Sparkles className="h-3 w-3" />
          Subha Live
        </p>
        <h1 className="mt-0.5 font-display text-[1.8rem] font-black tracking-[-0.04em] text-ink">
          Discover
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Join a PK battle, play a game, or catch a live event.
        </p>
      </header>

      <section className="px-4 pt-5">
        {/* Go Party — one tap creates a 10-seat audio party room and jumps
            straight into it. This is the only place audio rooms are
            created now; Home only creates video rooms. */}
        <button
          type="button"
          onClick={goParty}
          disabled={launching}
          className="grad-brand animate-gradient-shift glow-hot-lg relative mb-5 flex w-full items-center gap-4 overflow-hidden rounded-[28px] px-5 py-5 text-left text-white transition active:scale-[0.98] disabled:opacity-70"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            {launching ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <PartyPopper className="h-6 w-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black tracking-tight">Go Party</span>
            <span className="block text-xs text-white/80">
              {launching
                ? "Setting up your party…"
                : `Start an audio room with ${PARTY_SEAT_COUNT} open seats`}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/70" />
        </button>

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
            Some activity data couldn&apos;t load.
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
        className="grad-brand animate-gradient-shift glow-hot-lg relative block overflow-hidden rounded-[28px] px-5 py-6 text-white"
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
        className="grad-brand animate-gradient-shift glow-hot-lg relative block overflow-hidden rounded-[28px] px-5 py-6 text-white"
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
    <div className="stage-card relative overflow-hidden rounded-[28px] px-5 py-6 text-center">
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
          className="stage-card flex w-full items-center justify-center gap-2 p-4 text-xs font-semibold text-ink-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Couldn&apos;t load PK battles — tap to retry
        </button>
      ) : !battles || battles.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-white/15 bg-surface-raised/40 p-4 text-center text-xs text-ink-muted">
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
                className="stage-card flex items-center gap-3 p-3 transition-colors hover:border-accent-hot/40"
              >
                <div className="flex -space-x-3">
                  <span className="avatar-ring">
                    <Avatar
                      name={roomA?.host?.name ?? "Host A"}
                      src={roomA?.host?.avatar ?? undefined}
                      size="sm"
                      className="ring-2 ring-surface"
                    />
                  </span>
                  <span className="avatar-ring-static">
                    <Avatar
                      name={roomB?.host?.name ?? "Host B"}
                      src={roomB?.host?.avatar ?? undefined}
                      size="sm"
                      className="ring-2 ring-surface"
                    />
                  </span>
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

// Each tile gets its own gradient accent so the grid reads as colorful
// "activity chips" (matching the reference mockup's Discover tiles)
// instead of a flat repeated card.
const TILE_GRADIENTS = [
  "from-fuchsia-500 to-violet-600",
  "from-violet-500 to-indigo-600",
  "from-cyan-500 to-blue-600",
  "from-amber-400 to-rose-500",
];

function GamesSection() {
  return (
    <section>
      <SectionHeader icon={Gamepad2} title="Games" />
      <div className="grid grid-cols-2 gap-2.5">
        {GAMES.map((game, index) =>
          game.available ? (
            <Link
              key={game.id}
              href={`/home/party/games/${game.id}`}
              className="stage-card group flex flex-col justify-between p-3.5 text-left transition hover:border-accent-hot/40"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                  TILE_GRADIENTS[index % TILE_GRADIENTS.length],
                )}
              >
                <Gamepad2 className="h-4.5 w-4.5" />
              </span>
              <p className="mt-2.5 text-sm font-bold text-ink">{game.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                {game.description}
              </p>
              <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-accent-hot/15 px-2 py-0.5 text-[10px] font-bold text-accent-hot">
                Play now
              </span>
            </Link>
          ) : (
            <div
              key={game.id}
              className="flex flex-col justify-between rounded-[26px] border border-dashed border-white/12 bg-surface-raised/50 p-3.5 text-left opacity-70"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white opacity-60",
                  TILE_GRADIENTS[index % TILE_GRADIENTS.length],
                )}
              >
                <Gamepad2 className="h-4.5 w-4.5" />
              </span>
              <p className="mt-2.5 text-sm font-bold text-ink">{game.name}</p>
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
      <div className="flex items-center gap-3 rounded-[20px] border border-dashed border-white/15 bg-surface-raised/40 p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-ink-muted">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-ink">
            Scheduled events are coming soon
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            We&apos;ll surface hosted events and special activities here.
          </p>
        </div>
      </div>
    </section>
  );
}
