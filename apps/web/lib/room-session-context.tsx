"use client";

// Lifts the live WebRTC connection (host publish / viewer subscribe) out of
// the room route so it survives navigating to other pages inside /home/*.
// Next.js unmounts a route's component tree the instant you navigate away
// from it, which would normally tear down the RTCPeerConnection with it —
// this provider is mounted in app/home/layout.tsx instead, which stays
// mounted across all /home/* routes, so the connection (and the mini
// player built on top of it) keeps running while the room route itself
// mounts/unmounts freely underneath it.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import { useRoom } from "@/hooks/useRoom";
import { useWebRTC } from "@/hooks/useWebRTC";

interface RoomSessionRuntime {
  room: RoomRecord | null;
  roomLoading: boolean;
  roomError: boolean;
  refetchRoom: () => void;
  userId: string | null;
  isHost: boolean;
  isLive: boolean;
  isWaiting: boolean;
  actionLoading: boolean;

  hostPublishing: boolean;
  hostMediaReady: boolean;
  viewerConnected: boolean;
  speakerPublishing: boolean;
  mediaError: string;
  mediaState: ReturnType<typeof useWebRTC>["mediaState"];
  speakingSpeakerIds: ReturnType<typeof useWebRTC>["speakingSpeakerIds"];
  localStreamRef: RefObject<MediaStream | null>;
  remoteStreamRef: RefObject<MediaStream | null>;

  handleStart: () => Promise<void>;
  handleJoin: () => Promise<void>;
  handleLeave: () => Promise<void>;
  handleEnd: () => Promise<void>;
  publishGuestAudio: () => Promise<void>;
}

interface RoomSessionContextValue {
  activeRoomId: string | null;
  minimized: boolean;
  runtime: RoomSessionRuntime | null;
  /** Room page calls this on mount. Opening a different room than the one
   * currently active replaces it (only one live session/PiP at a time). */
  openRoom: (roomId: string) => void;
  minimize: () => void;
  expand: () => void;
  /** Fully disconnects and clears the session (real "leave", not PiP). */
  closeRoom: () => void;
}

const RoomSessionContext = createContext<RoomSessionContextValue | null>(null);

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  const { room, isLoading: roomLoading, isError: roomError, refetch: refetchRoom } =
    useRoom(activeRoomId);

  const isHost = !!room && !!userId && userId === room.host_id;
  const isLive = room?.status === "live";
  const isWaiting = room?.status === "created";

  const webrtc = useWebRTC(activeRoomId ? room : null, userId);
  const { startHost, joinViewer, leave, publishGuestAudio } = webrtc;

  const openRoom = useCallback((roomId: string) => {
    setActiveRoomId((current) => (current === roomId ? current : roomId));
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);

  const closeRoom = useCallback(() => {
    leave().catch(() => {});
    setActiveRoomId(null);
    setMinimized(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leave]);

  const handleStart = useCallback(async () => {
    if (!room) return;
    setActionLoading(true);
    try {
      const startedRoom = await roomsApi.start(room.id);
      await refetchRoom();
      await startHost(startedRoom ?? room);
      toast.success("You're live");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Start failed");
    } finally {
      setActionLoading(false);
    }
  }, [room, startHost, refetchRoom]);

  const handleJoin = useCallback(async () => {
    if (!room) return;
    setActionLoading(true);
    try {
      await Promise.all([
        roomsApi.join(room.id).catch((e) => {
          console.error("[handleJoin] failed to register room_participants row:", e);
        }),
        joinViewer(room),
      ]);
      toast.success("Connected to the live");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Join failed");
    } finally {
      setActionLoading(false);
    }
  }, [room, joinViewer]);

  const handleLeave = useCallback(async () => {
    await leave();
  }, [leave]);

  const handleEnd = useCallback(async () => {
    if (!room) return;
    setActionLoading(true);
    try {
      await roomsApi.end(room.id);
      toast.success("Live ended");
      refetchRoom();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "End failed");
    } finally {
      setActionLoading(false);
    }
  }, [room, refetchRoom]);

  // Auto-join for viewers, exactly once per room going live — lives here
  // (not the route) so it fires correctly even if the room was opened,
  // minimized, and re-entered rather than freshly mounted.
  //
  // Gated on `authChecked`, not just `userId`: room data can resolve
  // before supabase.auth.getUser() does, and userId briefly reads `null`
  // either way (before auth resolves, or if the person is genuinely
  // logged out). Without this gate, isHost is momentarily false for the
  // *actual host* on a refresh, this effect fires handleJoin() for them,
  // and the backend correctly rejects it with "Host cannot join as a
  // viewer" — a real bug, not a false alarm from the backend.
  useEffect(() => {
    if (!authChecked || !room || isHost || room.status !== "live") return;
    handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, room?.id, room?.status, isHost]);

  // Auto-resume host publishing after a refresh/reconnect while the room
  // is already "live" in the DB. The "Start" button (handleStart, above)
  // only ever applies to the very first publish out of the waiting room —
  // it also flips the room to live via roomsApi.start, which would
  // correctly reject with ROOM_INVALID_STATUS on a room that's already
  // live. This calls the WebRTC connect directly instead, and is exactly
  // what lets the real host reclaim their room within the reconnect grace
  // period (see media.config.ts's hostReconnectGraceMs) instead of being
  // stuck live with nothing actually broadcasting.
  useEffect(() => {
    if (!authChecked || !room || !isHost || room.status !== "live") return;
    if (webrtc.hostPublishing || webrtc.hostMediaReady) return;
    startHost(room).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, room?.id, room?.status, isHost, webrtc.hostPublishing, webrtc.hostMediaReady]);

  // If the host ends the room while a viewer is watching (full-screen or
  // minimized), tear the session down instead of leaving it dangling.
  useEffect(() => {
    if (!room || isHost) return;
    if (room.status === "ended") {
      toast.info("The host ended this live");
      closeRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, isHost]);

  const runtime: RoomSessionRuntime | null = activeRoomId
    ? {
        room,
        roomLoading,
        roomError,
        refetchRoom,
        userId,
        isHost,
        isLive,
        isWaiting,
        actionLoading,
        hostPublishing: webrtc.hostPublishing,
        hostMediaReady: webrtc.hostMediaReady,
        viewerConnected: webrtc.viewerConnected,
        speakerPublishing: webrtc.speakerPublishing,
        mediaError: webrtc.mediaError,
        mediaState: webrtc.mediaState,
        speakingSpeakerIds: webrtc.speakingSpeakerIds,
        localStreamRef: webrtc.localStreamRef,
        remoteStreamRef: webrtc.remoteStreamRef,
        handleStart,
        handleJoin,
        handleLeave,
        handleEnd,
        publishGuestAudio,
      }
    : null;

  const value = useMemo<RoomSessionContextValue>(
    () => ({ activeRoomId, minimized, runtime, openRoom, minimize, expand, closeRoom }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRoomId, minimized, runtime, openRoom, minimize, expand, closeRoom],
  );

  return <RoomSessionContext.Provider value={value}>{children}</RoomSessionContext.Provider>;
}

export function useRoomSession() {
  const ctx = useContext(RoomSessionContext);
  if (!ctx) {
    throw new Error("useRoomSession must be used within a RoomSessionProvider");
  }
  return ctx;
}

/**
 * Guards entering or starting a room while another one is already
 * live/minimized in the mini player. Only one live session can run at a
 * time (same as the mini player itself only ever holding one), so both
 * "join/open a room" and "create a new room" route through this instead of
 * navigating directly.
 */
export function useRoomEntryGuard() {
  const { activeRoomId, minimized, expand } = useRoomSession();
  const router = useRouter();

  const returnToActive = useCallback(() => {
    toast.info("You're already in a live — close it first to join another");
    if (minimized) expand();
    if (activeRoomId) router.push(`/home/room/${activeRoomId}`);
  }, [activeRoomId, minimized, expand, router]);

  /** Call before navigating into a specific room. Returns false (and
   * redirects back to the active session) if blocked. */
  const enterRoom = useCallback(
    (roomId: string) => {
      if (activeRoomId && activeRoomId !== roomId) {
        returnToActive();
        return false;
      }
      router.push(`/home/room/${roomId}`);
      return true;
    },
    [activeRoomId, router, returnToActive],
  );

  /** Call before opening the "create a room" flow. Returns false (and
   * redirects back to the active session) if blocked. */
  const guardCreate = useCallback(() => {
    if (activeRoomId) {
      returnToActive();
      return false;
    }
    return true;
  }, [activeRoomId, returnToActive]);

  /** Same guard as `enterRoom`, but for a plain <Link> (so the href still
   * works for prefetch/middle-click/etc.) — prevents the navigation and
   * redirects back to the active session instead of following the link. */
  const guardLinkClick = useCallback(
    (roomId: string) => (e: MouseEvent) => {
      if (activeRoomId && activeRoomId !== roomId) {
        e.preventDefault();
        returnToActive();
      }
    },
    [activeRoomId, returnToActive],
  );

  return { enterRoom, guardLinkClick, guardCreate, hasActiveSession: !!activeRoomId };
}