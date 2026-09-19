"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  ChevronRight,
  Loader2,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { BannerCarousel } from "@/components/BannerCarousel";
import { getPromoBanners } from "@/lib/promo-banners";
import { useCreateRoom, useRooms } from "@/hooks/queries/use-rooms";
import { useRoomPreview } from "@/hooks/useRoomPreview";
import type { RoomRecord } from "@/lib/api/rooms";
import type { RoomMediaType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * True while `ref`'s element is at least 50% visible in the viewport.
 * Used to drive the home-feed live previews: a card starts previewing as
 * it scrolls into view and stops the instant it scrolls back out, in
 * either direction.
 */
function useInView<T extends Element>(threshold = 0.5) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

const TABS = [
  { key: "all", label: "All" },
  { key: "nearby", label: "Nearby" },
  { key: "popular", label: "Popular" },
  { key: "featured", label: "Featured" },
  { key: "explore", label: "Explore" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function roomCategory(room: RoomRecord): Tab {
  const category = room.category?.toLowerCase();
  return TABS.some((tab) => tab.key === category)
    ? (category as Tab)
    : "explore";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <LivePageInner />
    </Suspense>
  );
}

function LivePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const promoBanners = useMemo(() => getPromoBanners(), []);
  const [createOpen, setCreateOpen] = useState(false);

  // Shared room-discovery hook (React Query) — same query/polling logic Party
  // and any other surface uses, so there's one source of truth for "list
  // rooms" instead of a page-local fetch+setInterval.
  const {
    data,
    isLoading: loading,
    isError,
    refetch,
  } = useRooms();
  const rooms = useMemo<RoomRecord[]>(() => data ?? [], [data]);
  const createRoomMutation = useCreateRoom();

  useEffect(() => {
    if (isError) {
      toast.error("Couldn't load live rooms");
    }
  }, [isError]);

  // Deep link from the bottom nav's "Go Live" button (`/home?create=1`).
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesTab = tab === "all" || roomCategory(room) === tab;
      if (!matchesTab) return false;

      if (!q) return true;

      return (
        room.title.toLowerCase().includes(q) ||
        room.host?.name?.toLowerCase().includes(q) ||
        room.host?.handle?.toLowerCase().includes(q)
      );
    });
  }, [rooms, tab, query]);

  const liveRooms = rooms.filter((room) => room.status === "live");
  const waitingRooms = rooms.filter((room) => room.status === "created");

  async function createRoom(input: {
    title: string;
    description: string;
    category: string;
    mediaType: RoomMediaType;
  }) {
    try {
      const room = await createRoomMutation.mutateAsync({
        title: input.title,
        description: input.description || null,
        category: input.category,
        livekit_room_name: `subha-${crypto.randomUUID()}`,
        max_guest_slots: 3,
        cover: null,
        media_type: input.mediaType,
      });

      setCreateOpen(false);
      router.push(`/home/room/${room.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create room",
      );
    }
  }

  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-[680px] bg-surface">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-brand-radial" />

      <header className="glass-panel sticky top-0 z-30 rounded-none border-x-0 border-t-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, width: "65%" }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: "65%" }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-surface-raised px-3.5 py-2.5"
              >
                <Search className="h-4 w-4 text-accent-hot" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search rooms or hosts"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="text-ink-faint"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-hot">
                  <Radio className="h-3 w-3 animate-live-dot" />
                  Subha Live
                </p>
                <h1 className="mt-0.5 font-display text-[1.8rem] font-black tracking-[-0.04em] text-ink">
                  Live rooms
                </h1>
              </div>
            )}
          </AnimatePresence>

          {!searchOpen && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-ink-muted transition hover:text-accent-hot active:scale-95"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setCreateOpen(true)}
                className="grad-brand animate-gradient-shift glow-hot flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Go Live
              </motion.button>
            </div>
          )}
        </div>

        <div className="stage-card mt-4 flex gap-1 overflow-x-auto p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="relative shrink-0 rounded-xl px-4 py-2 text-xs font-bold"
            >
              {tab === item.key && (
                <motion.span
                  layoutId="live-tab"
                  className="grad-brand absolute inset-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  tab === item.key ? "text-white" : "text-ink-faint",
                )}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="relative z-10 px-4 pt-4">
        <BannerCarousel items={promoBanners} />
      </div>

      <section className="relative z-10 px-4 pb-8 pt-5">
        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent-hot" />
              Loading live rooms…
            </div>
          </div>
        ) : isError && rooms.length === 0 ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-ink">
              Couldn&apos;t load live rooms
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-surface-raised px-4 py-2 text-xs font-bold text-ink transition hover:border-accent-hot/40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <EmptyRooms onCreate={() => setCreateOpen(true)} query={query} />
        ) : (
          <div className="space-y-7">
            {liveRooms.length > 0 && tab === "all" && !query && (
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-hot">
                      <span className="h-1.5 w-1.5 rounded-full bg-live animate-live-dot" />
                      Happening now
                    </p>
                    <h2 className="mt-0.5 text-xl font-black tracking-tight text-ink">
                      Live now
                    </h2>
                  </div>
                  <span className="grad-brand rounded-full px-2.5 py-1 text-[10px] font-bold text-white">
                    {liveRooms.length} live
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {liveRooms.map((room, index) => (
                    <RoomCard key={room.id} room={room} index={index} />
                  ))}
                </div>
              </section>
            )}

            {waitingRooms.length > 0 && tab === "all" && !query && (
              <section>
                <div className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-violet">
                    Coming up
                  </p>
                  <h2 className="mt-0.5 text-xl font-black tracking-tight text-ink">
                    Rooms waiting for the host
                  </h2>
                </div>
                <div className="space-y-2">
                  {waitingRooms.map((room) => (
                    <WaitingRoomCard key={room.id} room={room} />
                  ))}
                </div>
              </section>
            )}

            {(tab !== "all" || query) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredRooms.map((room, index) => (
                  <RoomCard key={room.id} room={room} index={index} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onCreate={createRoom}
        />
      )}
    </main>
  );
}

function RoomCard({ room, index }: { room: RoomRecord; index: number }) {
  const hostName = room.host?.name || "Subha host";
  const viewerCount = room.viewerCount ?? 0;
  const isLive = room.status === "live";
  const isAudioRoom = room.media_type === "audio";

  const { ref: viewRef, inView } = useInView<HTMLButtonElement>(0.5);
  const { stream, connected } = useRoomPreview(
    // Audio rooms never publish a camera, so there's nothing to preview —
    // skip connecting a preview session for them entirely.
    isLive && !isAudioRoom ? room.id : null,
    isLive && !isAudioRoom && inView,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream ?? null;
  }, [stream]);

  const showPreview = isLive && !isAudioRoom && connected && !!stream;

  return (
    <motion.button
      ref={viewRef}
      onClick={() => window.location.assign(`/home/room/${room.id}`)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      className="group relative aspect-[3/4] overflow-hidden rounded-[26px] border border-white/10 bg-surface-raised text-left shadow-sm transition-shadow duration-300 hover:glow-hot hover:border-accent-hot/40"
    >
      {isAudioRoom ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(160deg,#3a2e5c,#1c1430_55%,#0a0714)]">
          <span className="absolute h-24 w-24 rounded-full bg-accent-violet/25 blur-2xl animate-float-slow" />
          <Avatar
            name={hostName}
            src={room.host?.avatar ?? undefined}
            size="lg"
            className="relative ring-2 ring-white/25"
          />
        </div>
      ) : room.cover ? (
        <img
          src={room.cover}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            showPreview ? "opacity-0" : "opacity-100 group-hover:scale-105 transition-transform duration-500",
          )}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 bg-[linear-gradient(145deg,#272727,#111111_55%,#050505)] transition-opacity duration-300",
            showPreview && "opacity-0",
          )}
        />
      )}

      {/* Live preview — muted, silent viewer session (not counted toward
          viewerCount). Only mounted/connected while the card is scrolled
          into view; see useRoomPreview. Audio rooms never render this. */}
      {!isAudioRoom && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            showPreview ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />

      <div
        className={cn(
          "absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md",
          isLive ? "grad-brand glow-hot" : "bg-black/45",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-white",
            isLive && "animate-live-dot",
          )}
        />
        {isLive ? (isAudioRoom ? "LIVE AUDIO" : "LIVE") : "WAITING"}
      </div>

      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
        <Users className="h-2.5 w-2.5" />
        {viewerCount}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-center gap-2.5">
          <span className="avatar-ring shrink-0">
            <Avatar
              name={hostName}
              src={room.host?.avatar ?? undefined}
              size="sm"
              className="ring-2 ring-surface"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{hostName}</p>
            <p className="truncate text-[11px] text-white/65">{room.title}</p>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function WaitingRoomCard({ room }: { room: RoomRecord }) {
  const hostName = room.host?.name || "Subha host";

  return (
    <button
      onClick={() => window.location.assign(`/home/room/${room.id}`)}
      className="stage-card flex w-full items-center gap-3 p-3 text-left transition hover:border-accent-hot/40 hover:glow-hot"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-overlay text-accent-violet">
        <Radio className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{room.title}</p>
        <p className="truncate text-xs text-ink-muted">
          {hostName} · waiting to start
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-faint" />
    </button>
  );
}

function EmptyRooms({
  onCreate,
  query,
}: {
  onCreate: () => void;
  query: string;
}) {
  return (
    <div className="flex min-h-[48vh] flex-col items-center justify-center text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-surface-raised text-accent-hot">
        <span className="absolute inset-0 rounded-[28px] bg-accent-hot/10 animate-glow-pulse" />
        <Users className="relative h-8 w-8" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-ink">
        {query ? "No rooms found" : "Nothing is live yet"}
      </h2>
      <p className="mt-1 max-w-xs text-sm leading-6 text-ink-muted">
        {query
          ? "Try another room title or host."
          : "Create the first room and it will appear here for other users."}
      </p>
      {!query && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCreate}
          className="grad-brand glow-hot mt-5 rounded-full px-5 py-2.5 text-sm font-bold text-white"
        >
          Create a room
        </motion.button>
      )}
    </div>
  );
}

function CreateRoomModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string;
    category: string;
    mediaType: RoomMediaType;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("explore");
  const mediaType: RoomMediaType = "video";
  const [creating, setCreating] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Give the room a title");
      return;
    }

    try {
      setCreating(true);
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        category,
        mediaType,
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="stage-card glow-hot-lg w-full max-w-[520px] overflow-hidden rounded-[28px]"
      >
        <div className="grad-brand relative flex items-start justify-between px-5 py-5">
          <div className="absolute inset-0 opacity-20 animate-gradient-shift" />
          <div className="relative">
            <p className="text-lg font-black text-white">Start a live room</p>
            <p className="mt-0.5 text-xs text-white/75">
              Camera and microphone connect when you press Start Live.
            </p>
          </div>
          <button
            onClick={onClose}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/35"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-accent-hot/40 bg-accent-hot/10 px-4 py-3">
            <Camera className="h-4 w-4 text-accent-hot" />
            <div>
              <span className="block text-sm font-bold text-ink">Video room</span>
              <span className="text-[11px] text-ink-muted">
                Camera + mic, like going live. Want an audio-only party
                instead? Head to the Party tab.
              </span>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Room title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="What are you going live about?"
              className="w-full rounded-2xl border border-white/10 bg-surface-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-accent-hot/50"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              rows={3}
              placeholder="A short description"
              className="w-full resize-none rounded-2xl border border-white/10 bg-surface-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-accent-hot/50"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-surface-raised px-4 py-3 text-sm text-ink outline-none"
            >
              <option value="explore">Explore</option>
              <option value="nearby">Nearby</option>
              <option value="popular">Popular</option>
              <option value="featured">Featured</option>
            </select>
          </label>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={creating}
            className="grad-brand animate-gradient-shift glow-hot flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {creating ? "Creating room…" : "Create room"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
