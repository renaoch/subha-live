"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { MOCK_ROOMS, gradientFor } from "@/lib/mock-data";
import { mediaBadgeLabel, roomsApi } from "@/lib/api/rooms";
import type { LiveRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { key: LiveRoom["category"]; label: string }[] = [
  { key: "nearby", label: "Nearby" },
  { key: "popular", label: "Popular" },
  { key: "featured", label: "Featured" },
  { key: "explore", label: "Explore" },
];

export default function LivePage() {
  const router = useRouter();
  const [tab, setTab] = useState<LiveRoom["category"]>("nearby");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const trending = useMemo(() => MOCK_ROOMS.slice(0, 6), []);

  const rooms = useMemo(() => {
    const base = MOCK_ROOMS.filter((r) => r.category === tab);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (r) =>
        r.hostName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q),
    );
  }, [tab, query]);

  async function createRoom(input: {
    title: string;
    description: string;
    category: string;
  }) {
    try {
      const room = await roomsApi.create({
        title: input.title,
        description: input.description || null,
        category: input.category,
        livekit_room_name: `subha-${crypto.randomUUID()}`,
        max_guest_slots: 3,
        cover: null,
      });

      toast.success("Room created");
      setCreateOpen(false);
      router.push(`/home/room/${room.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create room",
      );
    }
  }

  return (
    <main className="mx-auto max-w-[560px]">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/80 px-4 pb-3 pt-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, width: "60%" }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: "60%" }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-2.5"
              >
                <Search className="h-4 w-4 shrink-0 text-ink-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a host or a room…"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="shrink-0 text-ink-muted transition-colors hover:text-ink"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.h1
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-display text-[1.7rem] font-bold tracking-[-0.03em] text-ink"
              >
                Live
              </motion.h1>
            )}
          </AnimatePresence>

          {!searchOpen && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-ink-muted transition-colors hover:text-ink"
              >
                <Search className="h-4.5 w-4.5" />
              </button>

              <button
                onClick={() => setCreateOpen(true)}
                className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-hot px-4 text-sm font-semibold text-white shadow-lg"
              >
                <Plus className="h-4 w-4" />
                Go Live
              </button>
            </div>
          )}
        </div>

        {!searchOpen && (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
            {trending.map((room) => (
              <a
                key={room.id}
                href={`/home/room/${room.id}`}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span className="relative">
                  <span className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[hsl(350_85%_60%)] to-accent-hot" />
                  <Avatar
                    name={room.hostName}
                    size="md"
                    className="relative ring-2 ring-surface"
                  />
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(350_85%_60%)] px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide text-white ring-2 ring-surface">
                    Live
                  </span>
                </span>
                <span className="max-w-[56px] truncate text-[11px] text-ink-muted">
                  {room.hostName}
                </span>
              </a>
            ))}
          </div>
        )}

        <div className="relative mt-4 flex gap-1 rounded-full bg-surface-raised p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors"
            >
              {tab === t.key && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-hot shadow-sm"
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  tab === t.key ? "text-white" : "text-ink-muted",
                )}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pb-6 pt-4">
        {rooms.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {rooms.map((room, i) => (
              <RoomCard key={room.id} room={room} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState query={query} />
        )}
      </div>

      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onCreate={createRoom}
        />
      )}
    </main>
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

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      toast.error("Give your room a title");
      return;
    }

    try {
      setCreating(true);
      await onCreate({
        title: cleanTitle,
        description: description.trim(),
        category,
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-ink">Create a live room</p>
            <p className="text-xs text-ink-muted">
              Your camera preview comes on the room screen.
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
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hot text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Video live</p>
              <p className="text-xs text-ink-muted">
                Camera and microphone are previewed before you start.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Room title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="What's happening?"
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="Tell people what this live is about"
              className="w-full resize-none rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-hot text-sm font-bold text-white disabled:opacity-60"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating room…
              </>
            ) : (
              <>
                Create room
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function RoomCard({ room, index }: { room: LiveRoom; index: number }) {
  return (
    <motion.a
      href={`/home/room/${room.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl shadow-panel"
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br transition-transform duration-500 group-hover:scale-110",
          gradientFor(room.hostName),
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25" />

      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1.5 pr-2 text-[10px] font-semibold text-white backdrop-blur-md">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(350_85%_65%)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(350_85%_65%)]" />
        </span>
        {room.viewerCount.toLocaleString()}
      </span>

      <span className="absolute right-2 top-2 rounded-full bg-black/45 px-1.5 py-0.5 text-xs backdrop-blur-md">
        {room.countryFlag}
      </span>

      <span
        className={cn(
          "absolute bottom-[52px] left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
          room.mediaType === "video" ? "bg-accent-hot/90" : "bg-indigo-500/90",
        )}
      >
        {mediaBadgeLabel(room.mediaType)}
      </span>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-white/10 bg-black/30 px-2.5 py-2 backdrop-blur-md">
        <Avatar name={room.hostName} size="sm" className="ring-1 ring-white/30" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">
            {room.hostName}
          </p>
          <p className="truncate text-[11px] text-white/60">{room.title}</p>
        </div>
      </div>
    </motion.a>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
        <Search className="h-5 w-5 text-ink-muted" />
      </div>
      <p className="text-sm font-medium text-ink">
        {query ? `No results for "${query}"` : "Nothing live here yet"}
      </p>
      <p className="max-w-[220px] text-xs text-ink-muted">
        {query
          ? "Try a different name or check another tab."
          : "Create a room with Go Live to test the real room flow."}
      </p>
    </div>
  );
}
