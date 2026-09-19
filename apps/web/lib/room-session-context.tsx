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
  type ReactNode,
  type RefObject,
} from "react";
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
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
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
  useEffect(() => {
    if (!room || isHost || room.status !== "live") return;
    handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.status, isHost]);

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
