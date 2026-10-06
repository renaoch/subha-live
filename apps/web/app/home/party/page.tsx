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
import { BannerCarousel } from "@/components/BannerCarousel";
import { getPromoBanners } from "@/lib/promo-banners";
import { useRoomEntryGuard } from "@/lib/room-session-context";
import { useRooms, useCreateRoom } from "@/hooks/queries/use-rooms";
import { useActivePkBattles } from "@/hooks/queries/use-pk";
import type { RoomRecord } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";
import { ProfileBackdrop } from "@/components/profile/profile-backdrop";

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
    id: "teen-patti",
    name: "Teen Patti",
    description: "Solo practice: draw 3 cards and see who wins. No real money.",
    available: true,
  },
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

  const promoBanners = useMemo(() => getPromoBanners(), []);

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
  const { guardCreate } = useRoomEntryGuard();

  async function goParty() {
    if (!guardCreate()) return;
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
    <main className="relative mx-auto min-h-dvh w-full max-w-[680px] overflow-hidden bg-[#0E0A18] pb-32">
      <ProfileBackdrop />
      <header className="relative z-10 px-5 pb-2 pt-6">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#FFB27A]">
          <Sparkles className="h-3 w-3" />
          Subha Live
        </p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-[#FFE6CC] to-[#FFB27A] bg-clip-text font-display text-[2rem] font-black tracking-[-0.04em] text-transparent">
          Discover
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Join a PK battle, play a game, or catch a live event.
        </p>
      </header>

      <div className="relative z-10 px-4 pt-3">
        <BannerCarousel items={promoBanners} />
      </div>

      <section className="relative z-10 px-4 pt-5">
        {/* Go Party — one tap creates a 10-seat audio party room and jumps
            straight into it. This is the only place audio rooms are
            created now; Home only creates video rooms. */}
        <button
          type="button"
          onClick={goParty}
          disabled={launching}
          className="group relative mb-6 flex w-full items-center gap-3 overflow-hidden rounded-full border border-[#FFB27A]/35 bg-[#1A1226]/80 p-2 pr-2 text-left shadow-[0_10px_30px_rgba(255,138,91,0.18)] backdrop-blur-xl transition active:scale-[0.98] disabled:opacity-70"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD36E] to-[#FF7A45] text-white shadow-[0_0_18px_rgba(255,138,91,0.55)]">
            {launching ? <Loader2 className="h-5 w-5 animate-spin" /> : <PartyPopper className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold tracking-tight text-white">Go Party</span>
            <span className="block truncate text-[11px] text-white/60">
              {launching ? "Setting up your party…" : `4 seats free · unlock up to ${PARTY_SEAT_COUNT} with coins`}
            </span>
          </span>
          <span className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#FFB04A] to-[#FF6A3D] px-5 text-sm font-extrabold text-[#2B1204] shadow-[0_6px_18px_rgba(255,106,61,0.45)]">
            Start
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-white/60">
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
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface-raised p-3 text-xs text-white/60">
            Some activity data couldn&apos;t load.
            <button
              onClick={() => refetchRooms()}
              className="flex items-center gap-1 font-semibold text-white"
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

const FEATURED_CLASS =
  "relative block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#2C1B4D]/90 via-[#1A1226]/90 to-[#2A1410]/90 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl transition active:scale-[0.99]";

function FeaturedGlow() {
  return (
    <>
      <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#FF7A45]/35 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-[#8B5CF6]/35 blur-3xl" />
    </>
  );
}

function LiveChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF4F6D] opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF4F6D]" />
      </span>
      Live · {label}
    </span>
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
  const { guardLinkClick } = useRoomEntryGuard();

  if (battle) {
    const roomA = roomsById.get(battle.room_a_id);
    const roomB = roomsById.get(battle.room_b_id);
    return (
      <Link
        href={`/home/room/${battle.room_a_id}`}
        onClick={guardLinkClick(battle.room_a_id)}
        className={FEATURED_CLASS}
      >
        <FeaturedGlow />
        <div className="relative flex items-center gap-3">
          <div className="flex -space-x-4">
            <Avatar name={roomA?.host?.name ?? "Host A"} src={roomA?.host?.avatar ?? undefined} size="lg" className="ring-2 ring-[#FF6A3D]" />
            <Avatar name={roomB?.host?.name ?? "Host B"} src={roomB?.host?.avatar ?? undefined} size="lg" className="ring-2 ring-[#8B5CF6]" />
          </div>
          <div className="min-w-0 flex-1">
            <LiveChip label="PK Battle" />
            <p className="mt-1.5 truncate font-display text-xl font-extrabold text-white">
              {roomA?.host?.name ?? "Host"} <span className="text-[#FFB27A]">vs</span> {roomB?.host?.name ?? "Host"}
            </p>
            <p className="text-xs text-white/60">Tap in to watch the battle live</p>
          </div>
          <Swords className="h-6 w-6 shrink-0 text-[#FFB27A]" />
        </div>
      </Link>
    );
  }

  if (room) {
    return (
      <Link
        href={`/home/room/${room.id}`}
        onClick={guardLinkClick(room.id)}
        className={FEATURED_CLASS}
      >
        <FeaturedGlow />
        <div className="relative flex items-center gap-3.5">
          <span className="rounded-full bg-gradient-to-br from-[#FFD36E] via-[#FF7A45] to-[#FF4F93] p-[2.5px] shadow-[0_0_22px_rgba(255,122,69,0.5)]">
            <Avatar name={room.host?.name ?? "Host"} src={room.host?.avatar ?? undefined} size="lg" className="ring-2 ring-[#170F2E]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <LiveChip label="Trending" />
              <span className="flex items-center gap-1 text-[11px] font-semibold text-white/70">
                <Users className="h-3 w-3" />
                {room.viewerCount ?? 0}
              </span>
            </div>
            <p className="mt-1.5 truncate font-display text-xl font-extrabold text-white">
              {room.host?.name ?? "Subha host"}
            </p>
            <p className="truncate text-xs text-white/60">{room.title}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white">
            Watch
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="border border-white/[0.09] bg-white/[0.05] shadow-[0_10px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl rounded-[22px] relative overflow-hidden rounded-[28px] px-5 py-6 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-white/60" />
      <p className="mt-2 text-sm font-semibold text-white">
        Nothing featured right now
      </p>
      <p className="mt-1 text-xs text-white/60">
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
    <div className="mb-3 mt-8 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#FFB04A]/30 to-[#FF6A3D]/15 text-[#FFB27A]">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-extrabold tracking-tight text-white">
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
  const { guardLinkClick } = useRoomEntryGuard();

  return (
    <section>
      <SectionHeader
        icon={Swords}
        title="PK Battles"
        action={
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
            {battles?.length ?? 0} active
          </span>
        }
      />

      {error ? (
        <button
          onClick={onRetry}
          className="border border-white/[0.09] bg-white/[0.05] shadow-[0_10px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl rounded-[22px] flex w-full items-center justify-center gap-2 p-4 text-xs font-semibold text-white/60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Couldn&apos;t load PK battles — tap to retry
        </button>
      ) : !battles || battles.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-center text-xs text-white/60">
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
                onClick={guardLinkClick(battle.room_a_id)}
                className="border border-white/[0.09] bg-white/[0.05] shadow-[0_10px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl rounded-[22px] flex items-center gap-3 p-3 transition-colors hover:border-accent-hot/40"
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
                  <p className="truncate text-sm font-bold text-white">
                    {roomA?.host?.name ?? "Host A"} vs{" "}
                    {roomB?.host?.name ?? "Host B"}
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
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
                      : "bg-surface text-white/60",
                  )}
                >
                  {isLive ? "LIVE" : battle.status}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />
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
              className="border border-white/[0.09] bg-white/[0.05] shadow-[0_10px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl rounded-[22px] group flex flex-col justify-between p-3.5 text-left transition hover:border-accent-hot/40"
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
                  TILE_GRADIENTS[index % TILE_GRADIENTS.length],
                )}
              >
                <Gamepad2 className="h-4.5 w-4.5" />
              </span>
              <p className="mt-2.5 text-sm font-bold text-white">{game.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/60">
                {game.description}
              </p>
              <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-accent-hot/15 px-2 py-0.5 text-[10px] font-bold text-accent-hot">
                Play now
              </span>
            </Link>
          ) : (
            <div
              key={game.id}
              className="flex flex-col justify-between rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] p-3.5 text-left opacity-70"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white opacity-60",
                  TILE_GRADIENTS[index % TILE_GRADIENTS.length],
                )}
              >
                <Gamepad2 className="h-4.5 w-4.5" />
              </span>
              <p className="mt-2.5 text-sm font-bold text-white">{game.name}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/60">
                {game.description}
              </p>
              <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-white/60">
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
      <div className="flex items-center gap-3 rounded-[20px] border border-dashed border-white/15 bg-white/[0.03] p-4 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-white/60">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            Scheduled events are coming soon
          </p>
          <p className="mt-0.5 text-xs text-white/60">
            We&apos;ll surface hosted events and special activities here.
          </p>
        </div>
      </div>
    </section>
  );
}