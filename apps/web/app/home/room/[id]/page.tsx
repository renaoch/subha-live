"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Gift, Mic, SendHorizonal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";

export default function RoomStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    roomsApi
      .get(id)
      .then((r) => setRoom(r))
      .catch(() =>
        toast.error(
          "Room not found — this route needs a real room id from your API",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleJoin() {
    try {
      await roomsApi.join(id);
      setJoined(true);
    } catch {
      toast.error("Couldn't join the room");
    }
  }

  async function handleLeave() {
    try {
      await roomsApi.leave(id);
    } finally {
      router.back();
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[560px] flex-col overflow-hidden bg-black text-white">
      {/* Video/audio surface placeholder — wire up @livekit/components-react
          here once you add livekit-client to apps/web dependencies. */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-fuchsia-900 to-black" />

      <header className="relative z-10 flex items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-2 rounded-full bg-black/40 py-1 pl-1 pr-3 backdrop-blur-sm">
          <Avatar name={room?.title ?? "Host"} size="sm" online />
          <div>
            <p className="text-xs font-semibold">
              {room?.title ?? "Loading…"}
            </p>
            <p className="text-[10px] text-white/60">
              {room?.status === "live" ? "● Live" : room?.status ?? ""}
            </p>
          </div>
        </div>

        <button
          onClick={handleLeave}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative z-10 mt-auto flex flex-col gap-3 px-4 pb-6">
        <div className="max-w-[85%] space-y-1.5 text-sm">
          <p className="text-white/80">
            <span className="text-fuchsia-300">Welcome Jacob</span> to the
            room
          </p>
          <p className="text-white/80">
            <span className="text-fuchsia-300">Welcome Leslie</span> to the
            room
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 backdrop-blur-md">
          <input
            placeholder="Type…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
          />

          {!joined ? (
            <button
              onClick={handleJoin}
              className="flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accent-hot px-3 text-xs font-semibold"
            >
              <Mic className="h-3.5 w-3.5" />
              Join
            </button>
          ) : (
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <SendHorizonal className="h-4 w-4" />
            </button>
          )}

          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Gift className="h-4 w-4 text-accent-hot" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <p className="text-sm text-white/70">Loading room…</p>
        </div>
      )}
    </main>
  );
}