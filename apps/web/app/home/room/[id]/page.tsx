"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Compass,
  Gift,
  Headphones,
  Link2,
  Loader2,
  Mail,
  Menu,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Radio,
  Share2,
  ShieldCheck,
  Smartphone,
  Star,
  ThumbsUp,
  Trophy,
  UserRound,
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
  type SpeakerRequest,
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
function waitForPeerConnectionConnected(
  peer: RTCPeerConnection,
  timeoutMs = 20000,
  stableMs = 300,
): Promise<void> {
  const isReady = () =>
    peer.connectionState === "connected" &&
    (
      peer.iceConnectionState === "connected" ||
      peer.iceConnectionState === "completed"
    );

  if (isReady()) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, stableMs);
    });
  }

  return new Promise((resolve, reject) => {
    let stableTimer: number | null =
      null;

    const cleanup = () => {
      window.clearTimeout(timeout);

      if (stableTimer !== null) {
        window.clearTimeout(
          stableTimer,
        );
      }

      peer.removeEventListener(
        "connectionstatechange",
        handleStateChange,
      );

      peer.removeEventListener(
        "iceconnectionstatechange",
        handleStateChange,
      );
    };

    const fail = (
      message: string,
    ) => {
      cleanup();
      reject(new Error(message));
    };

    const timeout = window.setTimeout(() => {
      fail(
        `Viewer PeerConnection did not become ready. connectionState=${peer.connectionState}, iceConnectionState=${peer.iceConnectionState}`,
      );
    }, timeoutMs);

    const handleStateChange =
      () => {
        if (
          peer.connectionState ===
            "failed" ||
          peer.connectionState ===
            "closed" ||
          peer.iceConnectionState ===
            "failed" ||
          peer.iceConnectionState ===
            "closed"
        ) {
          fail(
            `Viewer PeerConnection failed. connectionState=${peer.connectionState}, iceConnectionState=${peer.iceConnectionState}`,
          );
          return;
        }

        if (!isReady()) {
          return;
        }

        if (
          stableTimer !== null
        ) {
          return;
        }

        stableTimer =
          window.setTimeout(() => {
            stableTimer = null;

            if (isReady()) {
              cleanup();
              resolve();
            }
          }, stableMs);
      };

    peer.addEventListener(
      "connectionstatechange",
      handleStateChange,
    );

    peer.addEventListener(
      "iceconnectionstatechange",
      handleStateChange,
    );

    handleStateChange();
  });
}

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

  const [mediaError, setMediaError] =
    useState("");

  const [mediaState, setMediaState] =
    useState<RoomMediaState | null>(null);

  const [speakerPanelOpen, setSpeakerPanelOpen] =
    useState(false);

  const [speakerRequests, setSpeakerRequests] =
    useState<SpeakerRequest[]>([]);

  const [requestPending, setRequestPending] =
    useState(false);

  const [speakerPublishing, setSpeakerPublishing] =
    useState(false);

  const [speakerMediaError, setSpeakerMediaError] =
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

  const guestPeerRef =
    useRef<RTCPeerConnection | null>(null);

  const guestStreamRef =
    useRef<MediaStream | null>(null);

  const viewerSpeakerIdsRef =
    useRef<Set<string>>(new Set());

  const hostSpeakerIdsRef =
    useRef<Set<string>>(new Set());

  const speakerApprovalSeenRef =
    useRef(false);

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
    viewerSpeakerIdsRef.current.clear();

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null;
    }
  }

  function closeGuestPeer() {
    guestPeerRef.current?.close();
    guestPeerRef.current = null;
    guestStreamRef.current?.getTracks().forEach((track) => track.stop());
    guestStreamRef.current = null;
    setSpeakerPublishing(false);
  }

  function closeHostSubscriptions() {
    hostSpeakerIdsRef.current.clear();
  }

  async function publishGuestAudio() {
    if (!room || isHost || speakerPublishing) return;

    setSpeakerMediaError("");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    guestStreamRef.current = stream;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });

    guestPeerRef.current = peer;

    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("Microphone track was not created.");

    const transceiver = peer.addTransceiver(track, { direction: "sendonly" });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer);

    const firstDescription = peer.localDescription;
    if (!firstDescription?.sdp) throw new Error("Microphone SDP offer was not created.");

    const tracks = createPublishTracks([{
      transceiver,
      track,
      trackName: createTrackName("audio", userId ?? "speaker"),
    }]);

    const initial = await roomsApi.publishGuest(room.id, {
      offerSdp: firstDescription.sdp,
      tracks,
    });

    if (!initial.answerSdp) throw new Error("Guest media session did not return an SDP answer.");
    await peer.setRemoteDescription({ type: "answer", sdp: initial.answerSdp });
    await waitForPeerConnectionConnected(peer, 20000, 400);

    const renegotiationOffer = await peer.createOffer();
    await peer.setLocalDescription(renegotiationOffer);
    await waitForIceGatheringComplete(peer);

    const renegotiationDescription = peer.localDescription;
    if (!renegotiationDescription?.sdp) throw new Error("Guest audio negotiation offer was not created.");

    const result = await roomsApi.publishGuest(room.id, {
      offerSdp: renegotiationDescription.sdp,
      tracks,
    });

    if (!result.answerSdp) throw new Error("Guest audio negotiation failed.");
    await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });

    const speakerSession = result.session;
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        setSpeakerPublishing(false);
      }
    };

    setSpeakerPublishing(true);

    return speakerSession;
  }

async function syncHostGuestAudio(state: RoomMediaState) {
  const currentRoom = room;

  if (
    !currentRoom ||
    !isHost ||
    !hostPeerRef.current ||
    !hostMediaReady
  ) {
    return;
  }

    const speakerIds = Object.keys(state.speakers).filter(
      (speakerId) => !hostSpeakerIdsRef.current.has(speakerId),
    );

    if (speakerIds.length === 0) return;

    const peer = hostPeerRef.current;

    const attemptedIds: string[] = [];

    try {
      for (const speakerId of speakerIds) {
        peer.addTransceiver("audio", { direction: "recvonly" });
        attemptedIds.push(speakerId);
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGatheringComplete(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error("Host guest-audio SDP was not created.");

      const result = await roomsApi.subscribeHostToGuests(currentRoom.id, { offerSdp: localDescription.sdp });

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
      } else if (result.offerSdp) {
        await peer.setRemoteDescription({ type: "offer", sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForIceGatheringComplete(peer);
        const localAnswer = peer.localDescription;
        if (!localAnswer?.sdp) throw new Error("Host guest-audio answer was not created.");
        await roomsApi.subscribeHostToGuests(currentRoom.id, { answerSdp: localAnswer.sdp });
      } else {
        throw new Error("Host guest-audio negotiation returned no SDP.");
      }

      for (const speakerId of attemptedIds) {
        hostSpeakerIdsRef.current.add(speakerId);
      }
    } catch (error) {
      for (const speakerId of attemptedIds) {
        hostSpeakerIdsRef.current.delete(speakerId);
      }
      throw error;
    }

  }

  async function syncViewerSpeakerAudio(state: RoomMediaState) {
    const currentRoom = room;

    if (
      !currentRoom ||
      isHost ||
      !viewerPeerRef.current ||
      !viewerSessionRef.current
    ) {
      return;
    }

    const newSpeakers = Object.keys(state.speakers).filter(
      (speakerId) => !viewerSpeakerIdsRef.current.has(speakerId),
    );

    if (newSpeakers.length === 0) return;

    const peer = viewerPeerRef.current;
    for (const speakerId of newSpeakers) {
      peer.addTransceiver("audio", { direction: "recvonly" });
      viewerSpeakerIdsRef.current.add(speakerId);
    }

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer);

    const localDescription = peer.localDescription;
    if (!localDescription?.sdp) throw new Error("Viewer speaker-audio offer was not created.");

    const result = await roomsApi.createViewerSession(
  currentRoom.id,
  localDescription.sdp,
);

if (result.answerSdp) {
  await peer.setRemoteDescription({
    type: "answer",
    sdp: result.answerSdp,
  });

  return;
}

if (result.offerSdp) {
  await peer.setRemoteDescription({
    type: "offer",
    sdp: result.offerSdp,
  });

  const answer = await peer.createAnswer();

  await peer.setLocalDescription(answer);

  await waitForIceGatheringComplete(peer);

  const localAnswer = peer.localDescription;

  if (!localAnswer?.sdp) {
    throw new Error("Viewer speaker-audio answer was not created.");
  }

  await roomsApi.completeRenegotiation(
    currentRoom.id,
    localAnswer.sdp,
  );

  return;
}

    throw new Error("Viewer speaker-audio negotiation returned no SDP.");
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
    const state =
      await waitForHostMediaState(
        currentRoom.id,
        20000,
        500,
      );

    if (
      !state.host ||
      state.host.status !==
        "connected"
    ) {
      throw new Error(
        "The host is still connecting. Please try joining again in a moment.",
      );
    }

    const peer =
      new RTCPeerConnection({
        iceServers: [
          {
            urls:
              "stun:stun.cloudflare.com:3478",
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

    peer.onconnectionstatechange =
      () => {
        const ready =
          peer.connectionState ===
          "connected";

        setViewerConnected(
          ready,
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

    createViewerTransceivers(
      peer,
      state,
    );

    viewerSpeakerIdsRef.current = new Set(Object.keys(state.speakers));

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

    if (
      !initialResult.answerSdp
    ) {
      throw new Error(
        "Cloudflare did not return the initial viewer SDP answer.",
      );
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp:
        initialResult.answerSdp,
    });

    await waitForPeerConnectionConnected(
      peer,
      20000,
      500,
    );

    viewerSessionRef.current = {
      sessionId:
        initialResult.session.sessionId,
      generation:
        initialResult.session.generation,
    };

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

    if (
      result.answerSdp
    ) {
      await peer.setRemoteDescription({
        type: "answer",
        sdp:
          result.answerSdp,
      });
    } else if (
      result.offerSdp
    ) {
      await peer.setRemoteDescription({
        type: "offer",
        sdp:
          result.offerSdp,
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

      if (
        !localAnswer?.sdp
      ) {
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
        initialResult.session.sessionId,
      generation:
        initialResult.session.generation,
    };

    await waitForPeerConnectionConnected(
      peer,
      20000,
      500,
    );

    setViewerConnected(
      true,
    );
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

  useEffect(() => {
    if (!room || !isLive) return;

    let active = true;
    let mediaBusy = false;
    let requestBusy = false;

    const poll = async () => {
      try {
        const state = await roomsApi.getMediaState(id);
        if (!active) return;
        setMediaState(state);

        if (!isHost && state.speakers[userId ?? ""]) {
          setRequestPending(false);
          if (!speakerApprovalSeenRef.current) {
            speakerApprovalSeenRef.current = true;
            toast.success("Your audio seat was accepted");
          }
        }

        if (isHost) {
          if (!requestBusy) {
            requestBusy = true;
            try {
              setSpeakerRequests(await roomsApi.listSpeakerRequests(id));
            } finally {
              requestBusy = false;
            }
          }

          if (!mediaBusy) {
            mediaBusy = true;
            try {
              await syncHostGuestAudio(state);
            } catch (error) {
              console.error("Host guest audio sync failed", error);
            } finally {
              mediaBusy = false;
            }
          }
        } else {
          if (state.speakers[userId ?? ""] && !speakerPublishing && !mediaBusy) {
            mediaBusy = true;
            try {
              await publishGuestAudio();
            } catch (error) {
              setSpeakerMediaError(
                error instanceof Error ? error.message : "Microphone could not be connected.",
              );
              closeGuestPeer();
            } finally {
              mediaBusy = false;
            }
          }

          if (!mediaBusy && viewerConnected) {
            mediaBusy = true;
            try {
              await syncViewerSpeakerAudio(state);
            } catch (error) {
              console.error("Viewer speaker sync failed", error);
            } finally {
              mediaBusy = false;
            }
          }
        }
      } catch {
        // Keep the room playable during transient polling failures.
      }
    };

    void poll();
    const timer = window.setInterval(poll, 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, room, isLive, isHost, userId, viewerConnected, speakerPublishing, hostMediaReady]);

  useEffect(() => {
    if (!room || isHost || room.status !== "live" || joined) return;
    void handleJoin();
  }, [room?.id, room?.status, isHost]);

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

  useEffect(() => {
    if (!speakerPublishing || isHost) return;

    const timer = window.setInterval(() => {
      const session = guestPeerRef.current ? mediaState?.speakers[userId ?? ""] : null;
      if (!session) return;
      roomsApi.heartbeat(id, {
        role: "speaker",
        sessionId: session.sessionId,
        generation: mediaState?.generation ?? 0,
      }).catch(() => {});
    }, 15000);

    return () => window.clearInterval(timer);
  }, [id, speakerPublishing, isHost, userId, mediaState?.generation, mediaState?.speakers]);

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

  async function requestAudioSeat() {
    if (!room || isHost || requestPending) return;
    try {
      setActionLoading(true);
      await roomsApi.requestAudio(room.id);
      setRequestPending(true);
      toast.success("Audio seat requested");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t request an audio seat");
    } finally {
      setActionLoading(false);
    }
  }

  async function approveRequest(requestId: string) {
    try {
      await roomsApi.approveSpeakerRequest(id, requestId);
      setSpeakerRequests((current) => current.filter((request) => request.id !== requestId));
      toast.success("Viewer is joining the audio room");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t approve the request");
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      await roomsApi.rejectSpeakerRequest(id, requestId);
      setSpeakerRequests((current) => current.filter((request) => request.id !== requestId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t reject the request");
    }
  }

  async function handleLeave() {
    try {
      if (viewerSessionRef.current) {
        await roomsApi.leaveViewer(id).catch(() => {});
      }

      if (speakerPublishing) {
        await roomsApi.unpublishGuest(id).catch(() => {});
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
      closeGuestPeer();
      closeHostPeer();
      closeHostSubscriptions();
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

  useEffect(() => {
    return () => {
      closeViewerPeer();
      closeGuestPeer();
      closeHostPeer();
      closeHostSubscriptions();
      stopLocalMedia();
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black text-white">
        <Loader2 className="h-3 w-3 animate-spin" />
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
            className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
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

  const activeSpeakers = mediaState ? Object.values(mediaState.speakers) : [];
  const seatCount = Math.min(room.max_guest_slots || 3, 3);
  const occupiedSeats = Math.min(activeSpeakers.length, seatCount);

  return (
    <main className="min-h-[100svh] w-full overflow-hidden bg-black text-white">
      <section className="relative mx-auto h-[100svh] w-full max-w-[430px] overflow-hidden bg-black">

        {isHost && isWaiting ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : isHost && isLive ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : isLive ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            controls={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(120,70,40,0.45),transparent_34%),radial-gradient(circle_at_25%_55%,rgba(60,40,25,0.42),transparent_45%),#111]" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-black/35" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/80 via-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

        {mediaError && isHost && isWaiting && (
          <div className="absolute left-5 right-5 top-5 z-50 rounded-2xl border border-red-300/20 bg-black/70 px-4 py-3 text-xs text-red-100 backdrop-blur-xl">
            {mediaError}
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-30 px-[13px] pt-[53px] sm:pt-[53px]">
          <div className="flex items-center gap-[5px]">
            <Avatar
              name={hostName}
              src={room.host?.avatar ?? undefined}
              size="md"
              online={isLive}
              className="h-[38px] w-[38px] shrink-0 border border-white/10"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[17px] font-semibold leading-none">{hostName}</p>
                <span className="flex h-[12px] w-[12px] items-center justify-center rounded-full bg-white text-black">
                  <span className="text-[8px] font-black leading-none">✓</span>
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-none text-white/55">12.4K followers</p>
            </div>

            <button
              type="button"
              className="flex h-[30px] shrink-0 items-center rounded-full border border-white/20 bg-black/25 px-[14px] text-[15px] font-medium backdrop-blur-xl"
            >
              Follow
            </button>

            <button
              type="button"
              className="flex h-[30px] shrink-0 items-center gap-2 rounded-full border border-white/20 bg-black/25 px-[13px] text-[15px] font-medium backdrop-blur-xl"
            >
              <Smartphone className="h-[12px] w-[12px]" strokeWidth={1.7} />
              2 devices
            </button>

            <button
              type="button"
              className="flex h-[30px] shrink-0 items-center gap-2 rounded-full border border-white/20 bg-black/25 px-[13px] text-[15px] font-medium backdrop-blur-xl"
            >
              <UserRound className="h-[13px] w-[13px]" strokeWidth={1.7} />
              {room.viewerCount ?? mediaState?.viewerCount ?? 1200}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              aria-label="Close room"
              className="ml-1 flex h-[30px] w-[22px] shrink-0 items-center justify-end"
            >
              <X className="h-[19px] w-[19px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[102px] z-30 flex items-center justify-between px-[13px]">
          <button type="button" className="flex h-[28px] w-[94px] items-center justify-center gap-1 rounded-full border border-white/20 bg-black/20 px-4 backdrop-blur-xl">
            <Trophy className="h-[13px] w-[13px]" strokeWidth={1.7} />
            <span className="text-center text-[14px] leading-[1.15] font-medium">Top Ranking</span>
            <ChevronRight className="h-[12px] w-[12px]" strokeWidth={1.7} />
          </button>

          <button type="button" className="flex h-[28px] w-[88px] items-center justify-center gap-1 rounded-full border border-white/20 bg-black/20 px-4 backdrop-blur-xl">
            <BarChart3 className="h-[13px] w-[13px]" strokeWidth={1.7} />
            <span className="text-center text-[14px] leading-[1.15] font-medium">Daily No. 6</span>
            <ChevronRight className="h-[12px] w-[12px]" strokeWidth={1.7} />
          </button>

          <button type="button" className="flex h-[28px] w-[75px] items-center justify-center gap-1 rounded-full border border-white/20 bg-black/20 px-4 backdrop-blur-xl">
            <Compass className="h-[13px] w-[13px]" strokeWidth={1.7} />
            <span className="text-[14px] font-medium">Explore</span>
            <ChevronRight className="h-[12px] w-[12px]" strokeWidth={1.7} />
          </button>
        </div>

        <div className="absolute right-[12px] top-[148px] z-30 w-[214px] max-w-[calc(100%-48px)] rounded-[14px] border border-white/20 bg-[#0c0b0d]/85 p-[10px] backdrop-blur-2xl">
          <div className="flex items-center gap-1.5">
            <div className="h-[44px] w-[44px] shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-br from-white/40 via-white/10 to-black/60 ring-1 ring-white/10">
              <div className="h-full w-full bg-[radial-gradient(circle_at_58%_40%,rgba(255,255,255,0.75),transparent_14%),radial-gradient(circle_at_35%_65%,rgba(255,255,255,0.35),transparent_20%),linear-gradient(135deg,#5c5c5c,#111)]" />
            </div>
            <div className="min-w-[58px]">
              <p className="text-[15px] leading-tight">Space</p>
              <p className="text-[15px] leading-tight">Journey</p>
              <p className="mt-2 text-[25px] font-medium leading-none">0 / 3</p>
            </div>
            <div className="h-[42px] w-px bg-white/20" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5 text-[13px]">
                <span>Total Income</span>
                <span>45%</span>
              </div>
              <div className="mt-2.5 h-[9px] rounded-full bg-white/15">
                <div className="h-full w-[56%] rounded-full bg-white" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1.5 text-[12px]">
                <span>Lucky Stars</span>
                <span className="flex items-center gap-1">160 <Star className="h-3 w-3" strokeWidth={1.6} /></span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-[15px] bottom-[194px] z-30 w-[142px] space-y-2">
          {[
            { name: "Riya", text: "This stream is awesome!" },
            { name: "Aman", text: "Keep going bro!" },
            { name: "Neha", text: "Hello from Nepal!" },
          ].map((comment, index) => (
            <div key={comment.name} className="flex items-center gap-1.5 rounded-[15px] border border-white/10 bg-black/35 px-1.5 py-1 backdrop-blur-xl">
              <div className="h-[21px] w-[21px] shrink-0 overflow-hidden rounded-full bg-white/15 ring-1 ring-white/10">
                <div className="h-full w-full bg-gradient-to-br from-white/50 to-white/5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-none">{comment.name}</p>
                <p className="mt-1 text-[11px] leading-none text-white/85">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute left-[15px] bottom-[153px] z-30 w-[181px] max-w-[calc(100%-30px)] rounded-[12px] border border-white/10 bg-black/45 px-[11px] py-[10px] backdrop-blur-2xl">
          <div className="flex items-start gap-1">
            <ShieldCheck className="mt-1 h-[13px] w-[13px] shrink-0" strokeWidth={1.6} />
            <div>
              <p className="text-[13px] font-semibold leading-tight">Community Guidelines</p>
              <p className="mt-3 text-[11px] leading-[1.45] text-white/80">
                Please do not livestream any vulgar, pornographic (including child pornography), child sexual abuse and sexual exploitation, content that violates laws and habits, infringing or illegal content, otherwise your account will be banned by the app.
              </p>
            </div>
          </div>
        </div>

        <div className="absolute left-[15px] bottom-[95px] z-30 w-[181px] max-w-[calc(100%-30px)] rounded-[12px] border border-white/10 bg-black/45 px-[11px] py-[9px] backdrop-blur-2xl">
          <div className="flex items-start gap-1">
            <Bell className="mt-1 h-[13px] w-[13px] shrink-0" strokeWidth={1.6} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[13px] font-semibold">Room Boost</p>
                <ChevronRight className="h-3 w-3" strokeWidth={1.6} />
              </div>
              <p className="mt-2 text-[11px] leading-[1.45] text-white/75">Notify friends to start livestreaming, increasing room Hot Boost.</p>
            </div>
          </div>
        </div>

        <div className="absolute right-[15px] bottom-[153px] z-30 flex w-[111px] flex-col gap-1.5">
          <button type="button" className="flex h-[28px] items-center justify-between rounded-full border border-white/15 bg-black/45 px-3.5 backdrop-blur-xl">
            <span className="flex items-center gap-2 text-[11px]"><BarChart3 className="h-[13px] w-[13px]" strokeWidth={1.7} />Game Ranking</span>
            <ChevronRight className="h-3 w-3" strokeWidth={1.7} />
          </button>
          <button type="button" className="flex h-[28px] items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3.5 backdrop-blur-xl text-[11px]">
            <Share2 className="h-[14px] w-[14px]" strokeWidth={1.7} />
            Share
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSpeakerPanelOpen(true)}
          aria-label={`Open audio stage. ${occupiedSeats} of ${seatCount} occupied`}
          className="absolute right-[13px] top-1/2 z-40 flex h-[29px] w-[29px] -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-xl"
        >
          <Headphones className="h-[13px] w-[13px]" strokeWidth={1.6} />
          {occupiedSeats > 0 && (
            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">{occupiedSeats}</span>
          )}
        </button>

        <div className="absolute inset-x-0 bottom-[10px] z-40 flex items-center gap-[5px] px-[14px]">
          <div className="flex h-[29px] min-w-0 flex-1 items-center rounded-full border border-white/10 bg-black/45 px-[10px] text-[13px] text-white/45 backdrop-blur-xl">
            Say something...
          </div>

          {[
            { label: "Share link", icon: <Link2 className="h-[13px] w-[13px]" strokeWidth={1.7} /> },
            { label: "Messages", icon: <Mail className="h-[13px] w-[13px]" strokeWidth={1.7} /> },
            { label: "Menu", icon: <Menu className="h-[14px] w-[14px]" strokeWidth={1.7} /> },
            { label: "Gift", icon: <Gift className="h-[13px] w-[13px]" strokeWidth={1.7} /> },
          ].map((item) => (
            <button key={item.label} type="button" aria-label={item.label} className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/45 backdrop-blur-xl">
              {item.icon}
            </button>
          ))}

          <button type="button" aria-label="Like" className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full bg-white text-black">
            <ThumbsUp className="h-[12px] w-[12px]" strokeWidth={1.6} />
          </button>
        </div>

        {isHost && isWaiting && (
          <div className="absolute left-1/2 bottom-[43px] z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 p-1 backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => setCameraEnabled((value) => !value)}
              className="flex h-[24px] w-[24px] items-center justify-center rounded-full"
              aria-label="Toggle camera"
            >
              {cameraEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3 text-red-300" />}
            </button>
            <button
              type="button"
              onClick={() => setMicEnabled((value) => !value)}
              className="flex h-[24px] w-[24px] items-center justify-center rounded-full"
              aria-label="Toggle microphone"
            >
              {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3 text-red-300" />}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={actionLoading || !localStreamRef.current}
              className="flex h-[28px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
              <span>Start Live</span>
            </button>
          </div>
        )}

        {isHost && isLive && (
          <div className="absolute left-1/2 top-[46px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[8px] font-semibold backdrop-blur-xl">
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${hostMediaReady ? "animate-pulse bg-red-400" : "animate-pulse bg-amber-300"}`} />
            {hostMediaReady ? "LIVE" : "CONNECTING"}
          </div>
        )}

        {isLive && !viewerConnected && !isHost && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/15 backdrop-blur-[1px]">
            <div className="rounded-3xl border border-white/10 bg-black/45 px-6 py-5 text-center backdrop-blur-xl">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm font-semibold">Joining the live...</p>
            </div>
          </div>
        )}

        {speakerPublishing && !isHost && (
          <div className="absolute left-[15px] bottom-[154px] z-40 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[8px] font-semibold backdrop-blur-xl">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            You are speaking
          </div>
        )}

        {speakerMediaError && !isHost && (
          <div className="absolute left-[15px] right-[30px] bottom-[150px] z-50 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">
            {speakerMediaError}
          </div>
        )}

        {speakerPanelOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-4 pb-5"
            onClick={() => setSpeakerPanelOpen(false)}
          >
            <div
              className="relative w-full max-w-[390px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0c0f] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSpeakerPanelOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/5 hover:text-white"
                aria-label="Close audio stage"
              >
                <X className="h-4 w-4" />
              </button>
              <AudioSeatPanel
                isHost={isHost}
                requests={speakerRequests}
                speakers={activeSpeakers}
                seatCount={seatCount}
                pending={requestPending}
                requestLoading={actionLoading}
                onRequest={requestAudioSeat}
                onApprove={approveRequest}
                onReject={rejectRequest}
                hostName={hostName}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AudioSeatPanel({
  isHost,
  requests,
  speakers,
  seatCount,
  pending,
  requestLoading,
  onRequest,
  onApprove,
  onReject,
}: {
  isHost: boolean;
  requests: SpeakerRequest[];
  speakers: Array<{
    userId: string;
    sessionId: string;
    audioTrackName: string;
    videoTrackName?: string;
    hasVideo?: boolean;
  }>;
  seatCount: number;
  pending: boolean;
  requestLoading: boolean;
  onRequest: () => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  hostName: string;
}) {
  return (
    <div className="flex max-h-[75dvh] flex-col">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <p className="text-[8px] font-semibold text-white">Audio stage</p>
        <p className="text-[8px] text-white/35">
          {speakers.length}/{seatCount}
        </p>
      </div>

      <div className="flex items-center gap-1.5 px-5 pb-5">
        {Array.from({ length: seatCount }).map((_, index) => {
          const speaker = speakers[index];

          return (
            <div
              key={speaker?.userId ?? `empty-${index}`}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  speaker
                    ? "bg-white/[0.08] ring-1 ring-white/15"
                    : "border border-dashed border-white/10"
                }`}
              >
                {speaker ? (
                  <UserRound className="h-4.5 w-4.5 text-white/60" strokeWidth={1.75} />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                )}
              </div>

              <span className="truncate text-[10px] font-medium text-white/35">
                {speaker ? `Guest ${index + 1}` : "Open"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-px bg-white/[0.06]" />

      {isHost ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {requests.length === 0 ? (
            <p className="py-6 text-center text-[8px] text-white/25">No pending requests</p>
          ) : (
            <div className="space-y-1">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
                >
                  <Avatar
                    name={request.user?.name || "Viewer"}
                    src={request.user?.avatar ?? undefined}
                    size="sm"
                  />

                  <p className="flex-1 truncate text-[12px] font-medium text-white/75">
                    {request.user?.name || "Viewer"}
                  </p>

                  <button
                    type="button"
                    onClick={() => onReject(request.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label="Decline request"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onApprove(request.id)}
                    disabled={speakers.length >= seatCount}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-30"
                    aria-label="Accept request"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-4">
          {pending ? (
            <div className="flex items-center justify-center gap-1 rounded-xl py-3 text-[12px] text-white/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for the host
            </div>
          ) : speakers.length >= seatCount ? (
            <p className="py-3 text-center text-[12px] text-white/25">Stage is full</p>
          ) : (
            <button
              type="button"
              onClick={onRequest}
              disabled={requestLoading}
              className="flex w-full items-center justify-center gap-1 rounded-full bg-white py-3 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              <Mic className="h-3.5 w-3.5" />
              Request to speak
            </button>
          )}
        </div>
      )}
    </div>
  );
}