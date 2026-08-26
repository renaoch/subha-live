"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  ChevronRight,
  Loader2,
  Plus,
  Radio,
  Search,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { type RoomRecord } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";
import { useRooms, useCreateRoom } from "@/hooks/queries/use-rooms";
import { useUIStore } from "@/store/ui-store";

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
  const router = useRouter();
  // `tab` lives in zustand so it survives navigating away and back (e.g.
  // opening a room and returning), without lifting state or using context.
  const tab = useUIStore((s) => s.liveTab);
  const setTab = useUIStore((s) => s.setLiveTab);
  const createOpen = useUIStore((s) => s.createRoomOpen);
  const setCreateOpen = useUIStore((s) => s.setCreateRoomOpen);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Background-fetched + cached. `isLoading` is only true on the very first
  // load ever (per session) since data is served from cache afterward;
  // the 5s refresh happens silently without flipping `isLoading`.
  const { data: rooms = [], isLoading: loading } = useRooms();
  const createRoomMutation = useCreateRoom();

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
  }) {
    try {
      const room = await createRoomMutation.mutateAsync({
        title: input.title,
        description: input.description || null,
        category: input.category,
        livekit_room_name: `subha-${crypto.randomUUID()}`,
        max_guest_slots: 3,
        cover: null,
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
    <main className="mx-auto min-h-dvh w-full max-w-[680px] bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/90 px-4 pb-3 pt-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, width: "65%" }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: "65%" }}
                className="flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-3.5 py-2.5"
              >
                <Search className="h-4 w-4 text-ink-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search rooms or hosts"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="text-ink-muted"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                  Subha Live
                </p>
                <h1 className="mt-0.5 font-display text-[1.7rem] font-bold tracking-[-0.04em] text-ink">
                  Live rooms
                </h1>
              </div>
            )}
          </AnimatePresence>

          {!searchOpen && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-ink-muted"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface-raised px-4 text-sm font-bold text-ink shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Go Live
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-surface-raised p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="relative shrink-0 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              {tab === item.key && (
                <motion.span
                  layoutId="live-tab"
                  className="absolute inset-0 rounded-xl bg-ink"
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  tab === item.key ? "text-white" : "text-ink-muted",
                )}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      <section className="px-4 pb-8 pt-5">
        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live rooms…
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <EmptyRooms onCreate={() => setCreateOpen(true)} query={query} />
        ) : (
          <div className="space-y-7">
            {liveRooms.length > 0 && tab === "all" && !query && (
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      Happening now
                    </p>
                    <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink">
                      Live now
                    </h2>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-ink-muted">
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    Coming up
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink">
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

  return (
    <motion.button
      onClick={() => window.location.assign(`/home/room/${room.id}`)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      className="group relative aspect-[3/4] overflow-hidden rounded-[22px] border border-border/60 bg-surface-raised text-left shadow-sm"
    >
      {room.cover ? (
        <img
          src={room.cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#272727,#111111_55%,#050505)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />

      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.18)]" />
        {room.status === "live" ? "LIVE" : "WAITING"}
      </div>

      <div className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
        {viewerCount} watching
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar
            name={hostName}
            src={room.host?.avatar ?? undefined}
            size="sm"
            className="ring-1 ring-white/40"
          />
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
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 text-left transition hover:border-accent/40"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-ink-muted">
        <Radio className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{room.title}</p>
        <p className="truncate text-xs text-ink-muted">
          {hostName} · waiting to start
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-muted" />
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
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-surface-raised text-ink-muted">
        <Users className="h-7 w-7" />
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
        <button
          onClick={onCreate}
          className="mt-5 rounded-full border border-border bg-surface-raised px-5 py-2.5 text-sm font-bold text-ink"
        >
          Create a room
        </button>
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
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("explore");
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
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-ink">Start a live room</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Camera and microphone connect when you press Start Live.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-ink-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Room title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="What are you going live about?"
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink outline-none focus:border-accent"
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
              className="w-full resize-none rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink outline-none"
            >
              <option value="explore">Explore</option>
              <option value="nearby">Nearby</option>
              <option value="popular">Popular</option>
              <option value="featured">Featured</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-surface disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {creating ? "Creating room…" : "Create room"}
          </button>
        </form>
      </div>
    </div>
  );
}
