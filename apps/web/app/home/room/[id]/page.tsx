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
  Radio,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  roomsApi,
  type MediaTrackInput,
  type RoomMediaState,
  type RoomRecord,
} from "@/lib/api/rooms";
import { createClient } from "@/lib/supabase/client";

function waitForIceGatheringComplete(
  peer: RTCPeerConnection,
): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onStateChange = () => {
      if (peer.iceGatheringState === "complete") {
        peer.removeEventListener(
          "icegatheringstatechange",
          onStateChange,
        );
        resolve();
      }
    };

    peer.addEventListener(
      "icegatheringstatechange",
      onStateChange,
    );

    window.setTimeout(() => {
      peer.removeEventListener(
        "icegatheringstatechange",
        onStateChange,
      );
      resolve();
    }, 8000);
  });
}

async function waitForPeerConnectionConnected(
  peer: RTCPeerConnection,
  timeoutMs = 10000,
): Promise<void> {
  if (peer.connectionState === "connected") {
    return;
  }

  if (
    peer.connectionState === "failed" ||
    peer.connectionState === "closed"
  ) {
    throw new Error(
      `WebRTC connection failed before media negotiation (${peer.connectionState}).`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeout: number | undefined;

    const cleanup = () => {
      peer.removeEventListener(
        "connectionstatechange",
        onConnectionStateChange,
      );
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onConnectionStateChange = () => {
      if (peer.connectionState === "connected") {
        finish();
        return;
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        finish(
          new Error(
            `WebRTC connection failed (${peer.connectionState}).`,
          ),
        );
      }
    };

    timeout = window.setTimeout(() => {
      finish(
        new Error(
          "Timed out waiting for the Cloudflare WebRTC connection.",
        ),
      );
    }, timeoutMs);

    peer.addEventListener(
      "connectionstatechange",
      onConnectionStateChange,
    );

    onConnectionStateChange();
  });
}

/**
 * The room can become "live" before the host's media session
 * has finished being registered in the backend/Redis state.
 *
 * Viewers therefore must not fail immediately when state.host
 * is null. Wait briefly and poll until the host media state exists.
 */
async function waitForHostMediaState(
  roomId: string,
  timeoutMs = 20000,
  pollMs = 500,
): Promise<RoomMediaState> {
  const startedAt = Date.now();
  let lastState: RoomMediaState | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await roomsApi.getMediaState(roomId);

    if (
      lastState.host &&
      lastState.host.status === "connected"
    ) {
      return lastState;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, pollMs);
    });
  }

  if (lastState) {
    return lastState;
  }

  throw new Error("Host media state could not be loaded.");
}

function createTrackName(
  kind: "audio" | "video",
  userId: string,
) {
  return `room-${kind}-${userId}-${crypto.randomUUID()}`;
}

function createPublishTracks(
  transceivers: Array<{
    transceiver: RTCRtpTransceiver;
    track: MediaStreamTrack;
    trackName: string;
  }>,
): MediaTrackInput[] {
  return transceivers.map(
    ({
      transceiver,
      track,
      trackName,
    }) => {
      const mid = transceiver.mid;

      if (!mid) {
        throw new Error(
          `Browser did not assign an SDP MID for ${track.kind} track.`,
        );
      }

      return {
        trackName,
        kind:
          track.kind === "video"
            ? "video"
            : "audio",
        direction: "publish",
        mid,
      };
    },
  );
}

function createViewerTransceivers(
  peer: RTCPeerConnection,
  state: RoomMediaState,
) {
  if (!state.host) return;

  /*
   * Keep the browser's receive M-lines aligned with the
   * media that the backend is going to subscribe to.
   */
  peer.addTransceiver(
    "video",
    {
      direction: "recvonly",
    },
  );

  peer.addTransceiver(
    "audio",
    {
      direction: "recvonly",
    },
  );

  for (const speaker of Object.values(
    state.speakers,
  )) {
    peer.addTransceiver(
      "audio",
      {
        direction: "recvonly",
      },
    );

    if (speaker.videoTrackName) {
      peer.addTransceiver(
        "video",
        {
          direction: "recvonly",
        },
      );
    }
  }
}

export default function RoomStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [room, setRoom] =
    useState<RoomRecord | null>(null);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [joined, setJoined] =
    useState(false);

  const [hostPublishing, setHostPublishing] =
    useState(false);

  const [hostMediaReady, setHostMediaReady] =
    useState(false);

  const [viewerConnected, setViewerConnected] =
    useState(false);

  const [cameraEnabled, setCameraEnabled] =
    useState(true);

  const [micEnabled, setMicEnabled] =
    useState(true);

  const [copied, setCopied] =
    useState(false);

  const [mediaError, setMediaError] =
    useState("");

  const localVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const remoteVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const hostPeerRef =
    useRef<RTCPeerConnection | null>(null);

  const viewerPeerRef =
    useRef<RTCPeerConnection | null>(null);

  const remoteStreamRef =
    useRef<MediaStream | null>(null);

  const hostSessionRef =
    useRef<{
      sessionId: string;
      generation: number;
    } | null>(null);

  const viewerSessionRef =
    useRef<{
      sessionId: string;
      generation: number;
    } | null>(null);

  const isHost = Boolean(
    room &&
      userId &&
      room.host_id === userId,
  );

  const isLive =
    room?.status === "live";

  function stopLocalMedia() {
    localStreamRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        null;
    }
  }

  function closeHostPeer() {
    hostPeerRef.current?.close();

    hostPeerRef.current = null;
    hostSessionRef.current = null;
  }

  function closeViewerPeer() {
    viewerPeerRef.current?.close();

    viewerPeerRef.current = null;
    viewerSessionRef.current = null;
    remoteStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null;
    }
  }

  async function ensureLocalPreview() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: true,
          video: {
            facingMode: "user",
            width: {
              ideal: 1080,
            },
            height: {
              ideal: 1920,
            },
          },
        },
      );

    stream
      .getVideoTracks()
      .forEach((track) => {
        track.enabled =
          cameraEnabled;
      });

    stream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled =
          micEnabled;
      });

    localStreamRef.current =
      stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        stream;
    }

    return stream;
  }

  async function publishHostMedia(
    currentRoom: RoomRecord,
  ) {
    const stream =
      await ensureLocalPreview();

    const peer =
      new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.cloudflare.com:3478",
          },
        ],
        bundlePolicy: "max-bundle",
      });

    hostPeerRef.current =
      peer;

    const transceivers: Array<{
      transceiver: RTCRtpTransceiver;
      track: MediaStreamTrack;
      trackName: string;
    }> = [];

    for (
      const track of stream.getTracks()
    ) {
      const transceiver =
        peer.addTransceiver(
          track,
          {
            direction:
              "sendonly",
          },
        );

      transceivers.push({
        transceiver,
        track,
        trackName:
          createTrackName(
            track.kind ===
            "video"
              ? "video"
              : "audio",
            userId ??
              "host",
          ),
      });
    }

    const offer =
      await peer.createOffer();

    await peer.setLocalDescription(
      offer,
    );

    await waitForIceGatheringComplete(
      peer,
    );

    const localDescription =
      peer.localDescription;

    if (
      !localDescription?.sdp
    ) {
      throw new Error(
        "Browser did not generate a valid SDP offer.",
      );
    }

    const tracks =
      createPublishTracks(
        transceivers,
      );

    /*
     * Cloudflare sessions map directly to the browser
     * RTCPeerConnection. The first /sessions/new call
     * establishes the PeerConnection and returns its SDP
     * answer. We must apply that answer and wait for the
     * connection to become connected before asking Cloudflare
     * to add the local media tracks.
     */
    const initialResult =
      await roomsApi.publishHost(
        currentRoom.id,
        {
          offerSdp:
            localDescription.sdp,
          tracks,
        },
      );

    if (!initialResult.answerSdp) {
      throw new Error(
        "Cloudflare did not return the initial host SDP answer.",
      );
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: initialResult.answerSdp,
    });

    await waitForPeerConnectionConnected(
      peer,
    );

    const renegotiationOffer =
      await peer.createOffer();

    await peer.setLocalDescription(
      renegotiationOffer,
    );

    await waitForIceGatheringComplete(
      peer,
    );

    const renegotiationDescription =
      peer.localDescription;

    if (
      !renegotiationDescription?.sdp
    ) {
      throw new Error(
        "Browser did not generate a valid host track negotiation offer.",
      );
    }

    const result =
      await roomsApi.publishHost(
        currentRoom.id,
        {
          offerSdp:
            renegotiationDescription.sdp,
          tracks,
        },
      );

    if (!result.answerSdp) {
      throw new Error(
        "Cloudflare did not return the host track negotiation answer.",
      );
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: result.answerSdp,
    });

    hostSessionRef.current = {
      sessionId:
        result.session.sessionId,
      generation:
        result.session.generation,
    };

    /*
     * The backend should have registered the host
     * media state before publishHost() returns.
     *
     * Confirm that state is actually visible before
     * changing the UI to "Streaming to the room".
     */
    const mediaState =
      await waitForHostMediaState(
        currentRoom.id,
        5000,
        250,
      );

    if (
      !mediaState.host ||
      mediaState.host.sessionId !==
        result.session.sessionId
    ) {
      throw new Error(
        "Host media was published, but the room has not registered the host media state yet.",
      );
    }

    setHostMediaReady(true);
    setHostPublishing(true);

    peer.onconnectionstatechange =
      () => {
        if (
          peer.connectionState ===
            "failed" ||
          peer.connectionState ===
            "closed"
        ) {
          setHostPublishing(false);
          setHostMediaReady(false);
        }
      };
  }

  async function connectViewer(
    currentRoom: RoomRecord,
  ) {
    /*
     * Do not assume that room.status === "live"
     * means the host media is already available.
     *
     * Wait for the backend host media state.
     */
    const state =
      await waitForHostMediaState(
        currentRoom.id,
        20000,
        500,
      );

    if (!state.host) {
      throw new Error(
        "The host is still connecting. Please try joining again in a moment.",
      );
    }

    const peer =
      new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.cloudflare.com:3478",
          },
        ],
        bundlePolicy: "max-bundle",
      });

    viewerPeerRef.current =
      peer;

    const remoteStream =
      new MediaStream();

    remoteStreamRef.current =
      remoteStream;

    peer.ontrack = (
      event,
    ) => {
      for (
        const track of
          event.streams[0]
            ?.getTracks() ??
          [event.track]
      ) {
        if (
          !remoteStream
            .getTracks()
            .some(
              (item) =>
                item.id ===
                track.id,
            )
        ) {
          remoteStream.addTrack(
            track,
          );
        }
      }

      if (
        remoteVideoRef.current
      ) {
        remoteVideoRef.current.srcObject =
          remoteStream;

        void remoteVideoRef.current
          .play()
          .catch(() => {});
      }
    };

    createViewerTransceivers(
      peer,
      state,
    );

    const offer =
      await peer.createOffer();

    await peer.setLocalDescription(
      offer,
    );

    await waitForIceGatheringComplete(
      peer,
    );

    const localDescription =
      peer.localDescription;

    if (
      !localDescription?.sdp
    ) {
      throw new Error(
        "Browser did not generate a valid viewer SDP.",
      );
    }

    const initialResult =
      await roomsApi.createViewerSession(
        currentRoom.id,
        localDescription.sdp,
      );

    if (!initialResult.answerSdp) {
      throw new Error(
        "Cloudflare did not return the initial viewer SDP answer.",
      );
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: initialResult.answerSdp,
    });

    await waitForPeerConnectionConnected(
      peer,
    );

    const renegotiationOffer =
      await peer.createOffer();

    await peer.setLocalDescription(
      renegotiationOffer,
    );

    await waitForIceGatheringComplete(
      peer,
    );

    const renegotiationDescription =
      peer.localDescription;

    if (
      !renegotiationDescription?.sdp
    ) {
      throw new Error(
        "Browser did not generate a valid viewer track negotiation offer.",
      );
    }

    const result =
      await roomsApi.createViewerSession(
        currentRoom.id,
        renegotiationDescription.sdp,
      );

    if (result.answerSdp) {
      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.answerSdp,
      });
    } else if (result.offerSdp) {
      await peer.setRemoteDescription({
        type: "offer",
        sdp: result.offerSdp,
      });

      const answer =
        await peer.createAnswer();

      await peer.setLocalDescription(
        answer,
      );

      await waitForIceGatheringComplete(
        peer,
      );

      const localAnswer =
        peer.localDescription;

      if (!localAnswer?.sdp) {
        throw new Error(
          "Browser did not generate a valid viewer renegotiation answer.",
        );
      }

      await roomsApi.completeRenegotiation(
        currentRoom.id,
        localAnswer.sdp,
      );
    } else {
      throw new Error(
        "Cloudflare did not return a viewer track negotiation SDP.",
      );
    }

    viewerSessionRef.current = {
      sessionId:
        result.session.sessionId,
      generation:
        result.session.generation,
    };

    await waitForPeerConnectionConnected(
      peer,
    );

    setViewerConnected(true);

    peer.onconnectionstatechange =
      () => {
        setViewerConnected(
          peer.connectionState ===
            "connected",
        );

        if (
          peer.connectionState ===
            "failed" ||
          peer.connectionState ===
            "closed"
        ) {
          setViewerConnected(
            false,
          );
        }
      };
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase =
          createClient();

        const [
          { data },
          currentRoom,
        ] =
          await Promise.all([
            supabase.auth.getUser(),
            roomsApi.get(id),
          ]);

        if (!active) {
          return;
        }

        setUserId(
          data.user?.id ??
            null,
        );

        setRoom(
          currentRoom,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't load room",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    const interval =
      window.setInterval(
        async () => {
          try {
            const currentRoom =
              await roomsApi.get(
                id,
              );

            if (active) {
              setRoom(
                currentRoom,
              );
            }
          } catch {
            /*
             * Keep the current room state during
             * transient API failures.
             */
          }
        },
        3000,
      );

    return () => {
      active = false;
      window.clearInterval(
        interval,
      );
    };
  }, [id]);

  /*
   * Once the room is live, independently confirm that
   * the host media session exists in backend state.
   *
   * This prevents the host UI from getting stuck showing
   * "Connecting..." simply because the first state check
   * happened before Redis/API propagation completed.
   */
  useEffect(() => {
    if (
      !isHost ||
      room?.status !== "live"
    ) {
      if (!isHost) {
        setHostMediaReady(
          false,
        );
      }

      return;
    }

    let active = true;

    const checkHostMedia =
      async () => {
        try {
          const state =
            await roomsApi.getMediaState(
              id,
            );

          if (!active) {
            return;
          }

          const ready =
            state.host?.userId ===
            userId;

          setHostMediaReady(
            ready,
          );

          if (ready) {
            setHostPublishing(
              true,
            );
          }
        } catch {
          /*
           * Keep the current state during temporary
           * API/Redis failures.
           */
        }
      };

    void checkHostMedia();

    const timer =
      window.setInterval(
        checkHostMedia,
        1000,
      );

    return () => {
      active = false;
      window.clearInterval(
        timer,
      );
    };
  }, [
    id,
    isHost,
    room?.status,
    userId,
  ]);

  /*
   * Host camera/microphone preview.
   */
  useEffect(() => {
    if (
      !isHost ||
      room?.status !==
        "created"
    ) {
      return;
    }

    ensureLocalPreview().catch(
      (error) => {
        setMediaError(
          error instanceof Error
            ? error.message
            : "Camera or microphone permission was denied.",
        );
      },
    );

    return () => {
      /*
       * Keep the preview alive while this room remains mounted.
       */
    };
  }, [
    isHost,
    room?.status,
  ]);

  useEffect(() => {
    localStreamRef.current
      ?.getVideoTracks()
      .forEach(
        (track) => {
          track.enabled =
            cameraEnabled;
        },
      );
  }, [
    cameraEnabled,
  ]);

  useEffect(() => {
    localStreamRef.current
      ?.getAudioTracks()
      .forEach(
        (track) => {
          track.enabled =
            micEnabled;
        },
      );
  }, [
    micEnabled,
  ]);

  /*
   * Host heartbeat.
   */
  useEffect(() => {
    if (
      !hostSessionRef.current ||
      !isHost
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          const session =
            hostSessionRef.current;

          if (!session) {
            return;
          }

          roomsApi
            .heartbeat(
              id,
              {
                role: "host",
                sessionId:
                  session.sessionId,
                generation:
                  session.generation,
              },
            )
            .catch(() => {});
        },
        15000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [
    id,
    isHost,
    hostPublishing,
  ]);

  /*
   * Viewer heartbeat.
   */
  useEffect(() => {
    if (
      !viewerSessionRef.current ||
      isHost
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          const session =
            viewerSessionRef.current;

          if (!session) {
            return;
          }

          roomsApi
            .heartbeat(
              id,
              {
                role: "viewer",
                sessionId:
                  session.sessionId,
                generation:
                  session.generation,
              },
            )
            .catch(() => {});
        },
        15000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [
    id,
    isHost,
    viewerConnected,
  ]);

  async function handleStart() {
    if (
      !isHost ||
      !room
    ) {
      return;
    }

    try {
      setActionLoading(
        true,
      );

      setMediaError("");

      setHostMediaReady(
        false,
      );

      setHostPublishing(
        false,
      );

      const updated =
        await roomsApi.start(
          room.id,
        );

      setRoom(updated);

      await publishHostMedia(
        updated,
      );

      toast.success(
        "You're live",
      );
    } catch (error) {
      setMediaError(
        error instanceof Error
          ? error.message
          : "Couldn't start media.",
      );

      try {
        await roomsApi.end(
          room.id,
        );

        closeHostPeer();

        stopLocalMedia();

        setHostPublishing(
          false,
        );

        setHostMediaReady(
          false,
        );

        setRoom(
          await roomsApi.get(
            room.id,
          ),
        );
      } catch {
        /*
         * Keep the original media error visible.
         */
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't start the live",
      );
    } finally {
      setActionLoading(
        false,
      );
    }
  }

  async function handleJoin() {
    if (!room) {
      return;
    }

    try {
      setActionLoading(
        true,
      );

      await roomsApi.join(
        room.id,
      );

      setJoined(true);

      /*
       * connectViewer() now waits for the host media
       * state instead of immediately failing.
       */
      await connectViewer(
        room,
      );

      toast.success(
        "Connected to the live",
      );
    } catch (error) {
      setJoined(false);

      closeViewerPeer();

      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't join the live",
      );
    } finally {
      setActionLoading(
        false,
      );
    }
  }

  async function handleLeave() {
    try {
      if (
        viewerSessionRef.current
      ) {
        await roomsApi
          .leaveViewer(id)
          .catch(() => {});
      }

      if (joined) {
        await roomsApi
          .leave(id)
          .catch(() => {});
      }

      if (
        isHost &&
        room?.status ===
          "live"
      ) {
        await roomsApi
          .end(id)
          .catch(() => {});
      }
    } finally {
      closeViewerPeer();
      closeHostPeer();
      stopLocalMedia();

      setHostPublishing(
        false,
      );

      setHostMediaReady(
        false,
      );

      setViewerConnected(
        false,
      );

      router.push(
        "/home",
      );
    }
  }

  async function handleEnd() {
    if (
      !room ||
      !isHost
    ) {
      return;
    }

    try {
      setActionLoading(
        true,
      );

      await roomsApi.end(
        room.id,
      );

      closeHostPeer();

      stopLocalMedia();

      setHostPublishing(
        false,
      );

      setHostMediaReady(
        false,
      );

      setRoom(
        await roomsApi.get(
          room.id,
        ),
      );

      toast.success(
        "Live ended",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't end the live",
      );
    } finally {
      setActionLoading(
        false,
      );
    }
  }

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(
        window.location.href,
      );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1600,
      );
    } catch {
      toast.error(
        "Couldn't copy the room link",
      );
    }
  }

  useEffect(() => {
    return () => {
      closeViewerPeer();
      closeHostPeer();
      stopLocalMedia();
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-lg font-bold">
            Room not found
          </p>

          <button
            onClick={() =>
              router.push(
                "/home",
              )
            }
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Back home
          </button>
        </div>
      </main>
    );
  }

  const hostName =
    room.host?.name ||
    "Host";

  const isWaiting =
    room.status ===
    "created";

  const mediaReady = isHost
    ? hostMediaReady
    : viewerConnected;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.25),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.18),transparent_40%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[680px] flex-col">
        <header className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={hostName}
              src={
                room.host?.avatar ??
                undefined
              }
              size="sm"
              online={isLive}
              className="ring-1 ring-white/20"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {room.title}
              </p>

              <p className="truncate text-[11px] text-white/55">
                {hostName} ·{" "}
                {isLive
                  ? "Live now"
                  : "Waiting to start"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-semibold text-white/60 sm:block">
              {room.viewerCount ??
                0}{" "}
              watching
            </span>

            <button
              onClick={
                copyRoomLink
              }
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
              aria-label="Copy room link"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={
                handleLeave
              }
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
              aria-label="Close room"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col px-3 pb-4 sm:px-4">
          <div className="relative min-h-[72dvh] flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0610] shadow-2xl">
            {isHost &&
            isWaiting ? (
              <>
                <video
                  ref={
                    localVideoRef
                  }
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {mediaError && (
                  <div className="absolute left-3 right-3 top-3 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">
                    {mediaError}
                  </div>
                )}

                <div className="absolute left-3 top-3 flex gap-2">
                  <button
                    onClick={() =>
                      setCameraEnabled(
                        (value) =>
                          !value,
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-xl"
                    aria-label="Toggle camera"
                  >
                    {cameraEnabled ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-red-300" />
                    )}
                  </button>

                  <button
                    onClick={() =>
                      setMicEnabled(
                        (value) =>
                          !value,
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-xl"
                    aria-label="Toggle microphone"
                  >
                    {micEnabled ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-300" />
                    )}
                  </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="rounded-[24px] border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />

                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                            Private preview
                          </span>
                        </div>

                        <h2 className="text-xl font-bold tracking-tight">
                          Check your camera and mic
                        </h2>

                        <p className="mt-1 text-xs text-white/55">
                          Your live starts when you press the button.
                        </p>
                      </div>

                      <button
                        onClick={
                          handleStart
                        }
                        disabled={
                          actionLoading ||
                          !localStreamRef.current
                        }
                        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-hot px-5 text-sm font-bold shadow-lg disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 fill-current" />
                        )}

                        Start Live
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : isHost &&
              isLive ? (
              <>
                <video
                  ref={
                    localVideoRef
                  }
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hostMediaReady
                        ? "animate-pulse bg-red-400"
                        : "animate-pulse bg-amber-300"
                    }`}
                  />

                  {hostMediaReady
                    ? "LIVE"
                    : "CONNECTING"}
                </div>

                {!hostMediaReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 px-8 text-center backdrop-blur-[1px]">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>

                      <h2 className="mt-4 text-lg font-bold">
                        Connecting your live
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-white/55">
                        Your camera and microphone are connecting to the room.
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={
                        hostName
                      }
                      src={
                        room.host
                          ?.avatar ??
                        undefined
                      }
                      size="sm"
                    />

                    <div>
                      <p className="text-sm font-bold">
                        {hostName}
                      </p>

                      <p className="text-[10px] text-white/55">
                        {hostMediaReady
                          ? "Streaming to the room"
                          : "Connecting…"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={
                      handleEnd
                    }
                    disabled={
                      actionLoading
                    }
                    className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-50"
                  >
                    End live
                  </button>
                </div>
              </>
            ) : isLive ? (
              <>
                <video
                  ref={
                    remoteVideoRef
                  }
                  autoPlay
                  playsInline
                  controls={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />

                {!viewerConnected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 px-8 text-center backdrop-blur-sm">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                        {joined ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Radio className="h-6 w-6" />
                        )}
                      </div>

                      <h2 className="mt-4 text-lg font-bold">
                        {joined
                          ? "Connecting to the live…"
                          : "Live now"}
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-white/55">
                        {joined
                          ? "Waiting for the host media connection."
                          : "Join to watch the host live."}
                      </p>

                      {!joined && (
                        <button
                          onClick={
                            handleJoin
                          }
                          disabled={
                            actionLoading
                          }
                          className="mt-5 rounded-full bg-gradient-to-r from-accent to-accent-hot px-6 py-3 text-sm font-bold"
                        >
                          {actionLoading
                            ? "Connecting…"
                            : "Join live"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {viewerConnected && (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    LIVE ·{" "}
                    {hostName}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                    <Radio className="h-7 w-7 text-white/70" />
                  </div>

                  <h2 className="mt-5 text-xl font-bold">
                    {isWaiting
                      ? "Waiting for the host"
                      : "This live has ended"}
                  </h2>

                  <p className="mt-2 max-w-xs text-sm leading-6 text-white/45">
                    {isWaiting
                      ? "The host is getting their camera and microphone ready."
                      : "The room is no longer live."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-white/40">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />

              {room.viewerCount ??
                0}{" "}
              watching
            </span>

            <span>
              {room.max_guest_slots}{" "}
              guest slots
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}