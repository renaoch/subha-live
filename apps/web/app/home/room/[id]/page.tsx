"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Loader2,
  Mic,
  MicOff,
  Play,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";

export default function RoomStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [mediaError, setMediaError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const isHost = Boolean(room && userId && room.host_id === userId);
  const isLive = room?.status === "live";

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      try {
        const [{ data }, currentRoom] = await Promise.all([
          supabase.auth.getUser(),
          roomsApi.get(id),
        ]);

        if (!active) return;

        setUserId(data.user?.id ?? null);
        setRoom(currentRoom);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't load room",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    const interval = window.setInterval(async () => {
      try {
        const currentRoom = await roomsApi.get(id);
        if (active) setRoom(currentRoom);
      } catch {
        // Preserve the last good state during a transient refresh failure.
      }
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    if (!isHost || isLive) {
      stopPreview();
      return;
    }

    let cancelled = false;

    async function startPreview() {
      try {
        setMediaError("");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 360 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;

        stream.getVideoTracks().forEach((track) => {
          track.enabled = cameraEnabled;
        });

        stream.getAudioTracks().forEach((track) => {
          track.enabled = micEnabled;
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        setMediaError(
          error instanceof Error
            ? error.message
            : "Camera or microphone permission was denied.",
        );
      }
    }

    startPreview();

    return () => {
      cancelled = true;
      stopPreview();
    };
    // The preview is created once for the pre-live host screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, isLive]);

  useEffect(() => {
    previewStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled]);

  useEffect(() => {
    previewStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  function stopPreview() {
    const stream = previewStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function handleStart() {
    if (!isHost || !room) return;

    try {
      setActionLoading(true);
      const updated = await roomsApi.start(room.id);
      setRoom(updated);
      toast.success("You're live");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't start the room",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJoin() {
    if (!room) return;

    try {
      setActionLoading(true);
      await roomsApi.join(room.id);
      setJoined(true);
      toast.success("Joined the room");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't join the room",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    try {
      if (joined) {
        await roomsApi.leave(id);
      }
    } catch {
      // Navigation should still happen if the leave request fails.
    } finally {
      stopPreview();
      router.push("/home");
    }
  }

  async function handleEnd() {
    if (!room || !isHost) return;

    try {
      setActionLoading(true);
      const updated = await roomsApi.end(room.id);
      setRoom(updated);
      stopPreview();
      toast.success("Live ended");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't end the room",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the room link");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black text-white">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading room…
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Room not found</p>
          <button
            onClick={() => router.push("/home")}
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Back home
          </button>
        </div>
      </main>
    );
  }

  const statusLabel =
    room.status === "created"
      ? isHost
        ? "Ready to go live"
        : "Waiting for host"
      : room.status === "live"
        ? "Live now"
        : room.status === "ended"
          ? "Ended"
          : "Ending…";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.28),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.18),transparent_35%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
        <header className="flex items-center justify-between px-4 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={room.title} size="sm" online={isLive} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{room.title}</p>
              <p className="text-[11px] text-white/55">{statusLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomLink}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md"
              aria-label="Copy room link"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleLeave}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md"
              aria-label="Close room"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="relative flex flex-1 flex-col px-4 pb-5">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-900 via-purple-950/80 to-black shadow-2xl">
            {isHost && !isLive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />

                {mediaError && (
                  <div className="absolute inset-x-4 top-4 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-200 backdrop-blur-md">
                    {mediaError}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/60">Private preview</p>
                      <p className="text-sm font-semibold">
                        Everything looks good?
                      </p>
                    </div>

                    <button
                      onClick={handleStart}
                      disabled={actionLoading}
                      className="flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-hot px-5 text-sm font-bold shadow-lg disabled:opacity-60"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                      Start live
                    </button>
                  </div>
                </div>

                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <button
                    onClick={() => setCameraEnabled((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-md"
                    aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                  >
                    {cameraEnabled ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-red-300" />
                    )}
                  </button>

                  <button
                    onClick={() => setMicEnabled((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-md"
                    aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
                  >
                    {micEnabled ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-300" />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                    {isLive ? (
                      <Users className="h-7 w-7 text-white/80" />
                    ) : (
                      <Video className="h-7 w-7 text-white/60" />
                    )}
                  </div>

                  <p className="mt-5 text-lg font-semibold">
                    {isLive
                      ? isHost
                        ? "Your live room is ready"
                        : "You're watching the room"
                      : room.status === "created"
                        ? "The host hasn't started yet"
                        : "This live has ended"}
                  </p>

                  <p className="mt-2 max-w-[280px] text-xs leading-5 text-white/50">
                    {isLive
                      ? "The live media surface will be connected to Cloudflare next."
                      : isHost
                        ? "Your camera preview is ready above."
                        : "Keep this page open. It will update when the host starts."}
                  </p>

                  {isLive && !isHost && !joined && (
                    <button
                      onClick={handleJoin}
                      disabled={actionLoading}
                      className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-hot px-6 text-sm font-bold"
                    >
                      {actionLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Join room
                    </button>
                  )}

                  {isLive && !isHost && joined && (
                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold">
                      <Check className="h-4 w-4" />
                      Joined
                    </div>
                  )}

                  {isHost && isLive && (
                    <button
                      onClick={handleEnd}
                      disabled={actionLoading}
                      className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-bold hover:bg-white/15 disabled:opacity-60"
                    >
                      {actionLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      End live
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-white/45">
            <span className="max-w-[75%] truncate">Room ID: {room.id}</span>
            <span>{room.max_guest_slots} guest slots</span>
          </div>
        </section>
      </div>
    </main>
  );
}
