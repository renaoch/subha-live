"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BellRing,
  ChevronRight,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  X,
  Play,
  Radio,
  ShieldCheck,
  UserRound,
  Users,
  Video,
  VideoOff,
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
    for (const speakerId of speakerIds) {
      peer.addTransceiver("audio", { direction: "recvonly" });
      hostSpeakerIdsRef.current.add(speakerId);
    }

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer);

    const localDescription = peer.localDescription;
    if (!localDescription?.sdp) throw new Error("Host guest-audio SDP was not created.");

    const result = await roomsApi.subscribeHostToGuests(currentRoom.id, { offerSdp: localDescription.sdp });

    if (result.answerSdp) {
      await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
      return;
    }

    if (result.offerSdp) {
      await peer.setRemoteDescription({ type: "offer", sdp: result.offerSdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGatheringComplete(peer);
      const localAnswer = peer.localDescription;
      if (!localAnswer?.sdp) throw new Error("Host guest-audio answer was not created.");
      await roomsApi.subscribeHostToGuests(currentRoom.id, { answerSdp: localAnswer.sdp });
      return;
    }

    throw new Error("Host guest-audio negotiation returned no SDP.");
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
     * Wait until the host session is actually marked
     * connected in backend media state.
     */
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

    /*
     * Phase 1:
     * Establish the Cloudflare session.
     *
     * The backend sends this offer to /sessions/new
     * and returns the initial SDP answer.
     */
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

    /*
     * Cloudflare requires the PeerConnection for a session
     * to be connected before operations such as pulling tracks.
     *
     * Wait for BOTH the browser connection state and ICE
     * state, then allow a short stabilization window before
     * calling tracks/new.
     */
    await waitForPeerConnectionConnected(
      peer,
      20000,
      500,
    );

    /*
     * Keep the session ID immediately after the first
     * successful session creation. The second API call uses
     * the same Cloudflare session.
     */
    viewerSessionRef.current = {
      sessionId:
        initialResult.session.sessionId,
      generation:
        initialResult.session.generation,
    };

    /*
     * Phase 2:
     * Now that the Cloudflare PeerConnection is connected,
     * create a fresh offer and ask the backend to add the
     * host/speaker remote tracks through /tracks/new.
     */
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

    /*
     * Cloudflare can return either:
     *
     * 1. SDP answer:
     *    apply it directly.
     *
     * 2. SDP offer:
     *    apply it, create the browser answer, and send
     *    that answer through /renegotiate.
     */
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

    /*
     * Keep the same Cloudflare session identity from the
     * backend. The second response should refer to the same
     * session, but the first response is the authoritative
     * session created for this browser PeerConnection.
     */
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

  const activeSpeakers = mediaState ? Object.values(mediaState.speakers) : [];
  const seatCount = Math.min(room.max_guest_slots || 3, 3);
  const occupiedSeats = Math.min(activeSpeakers.length, seatCount);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#06060a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,0.22),transparent_30%),radial-gradient(circle_at_88%_22%,rgba(236,72,153,0.16),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col px-2 sm:px-3">
        <header className="flex items-center justify-between px-2 pb-3 pt-4 sm:px-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={hostName}
              src={room.host?.avatar ?? undefined}
              size="sm"
              online={isLive}
              className="ring-1 ring-white/20"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold sm:text-base">{room.title}</p>
              <p className="truncate text-[11px] text-white/50 sm:text-xs">
                {hostName} · {isLive ? "Live now" : isWaiting ? "Waiting to start" : "Ended"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/65 sm:flex">
              <Users className="h-3.5 w-3.5" />
              {room.viewerCount ?? mediaState?.viewerCount ?? 0} watching
            </div>
            <button
              onClick={handleLeave}
              className="flex h-10 items-center gap-2 rounded-full bg-red-500 px-4 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-400"
            >
              <PhoneOff className="h-4 w-4" />
              Leave room
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-3 pb-4 sm:gap-4">
          <section className="relative min-h-[78dvh] flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b10] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
            {isHost && isWaiting ? (
              <>
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
                {mediaError && (
                  <div className="absolute left-3 right-3 top-3 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">{mediaError}</div>
                )}
                <div className="absolute left-3 top-3 flex gap-2">
                  <button onClick={() => setCameraEnabled((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-xl">
                    {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-300" />}
                  </button>
                  <button onClick={() => setMicEnabled((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-xl">
                    {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-300" />}
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="rounded-[26px] border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="mb-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Private preview</span></div>
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Check your camera and mic</h2>
                        <p className="mt-1 text-xs text-white/50">Your room becomes live when you press Start Live.</p>
                      </div>
                      <button onClick={handleStart} disabled={actionLoading || !localStreamRef.current} className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-hot px-5 text-sm font-bold shadow-xl disabled:opacity-50">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} Start Live
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : isHost && isLive ? (
              <>
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                  <span className={`h-2 w-2 rounded-full ${hostMediaReady ? "animate-pulse bg-red-400" : "animate-pulse bg-amber-300"}`} />
                  {hostMediaReady ? "LIVE" : "CONNECTING"}
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <Avatar name={hostName} src={room.host?.avatar ?? undefined} size="sm" />
                    <div><p className="text-sm font-bold">{hostName}</p><p className="text-[10px] text-white/55">{occupiedSeats > 0 ? `${occupiedSeats} guest${occupiedSeats === 1 ? "" : "s"} on stage` : "You are live"}</p></div>
                  </div>
                  <button onClick={handleEnd} disabled={actionLoading} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-50">End live</button>
                </div>
              </>
            ) : isLive ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline controls={false} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/5" />
                {!viewerConnected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 px-8 text-center backdrop-blur-[2px]">
                    <div>
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.08]"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      <h2 className="mt-5 text-xl font-bold">Joining the live…</h2>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-white/50">Connecting your room viewer. No extra join button, because apparently we can spare humans one click.</p>
                    </div>
                  </div>
                )}
                {viewerConnected && (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> LIVE · {hostName}
                  </div>
                )}
                {speakerPublishing && (
                  <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                    <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> You are speaking
                  </div>
                )}
                {speakerMediaError && (
                  <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">{speakerMediaError}</div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10"><Radio className="h-7 w-7 text-white/70" /></div><h2 className="mt-5 text-xl font-bold">{isWaiting ? "Waiting for the host" : "This live has ended"}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-white/45">{isWaiting ? "The host is getting their camera and microphone ready." : "The room is no longer live."}</p></div>
              </div>
            )}
          </section>

        <button
          type="button"
          onClick={() => setSpeakerPanelOpen(true)}
          className="absolute right-4 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-200 hover:scale-105 hover:bg-black/40 active:scale-95"
          aria-label={`Open audio stage. ${occupiedSeats} of ${seatCount} occupied`}
        >
          <Headphones className="h-5 w-5" strokeWidth={1.8} />
          <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black/50 bg-white px-1 text-[9px] font-bold text-black">
            {occupiedSeats}
          </span>
        </button>

        {speakerPanelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[6px]"
            onClick={() => setSpeakerPanelOpen(false)}
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d12]/90 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSpeakerPanelOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/40 transition hover:bg-white/[0.09] hover:text-white"
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
        </div>
      </div>
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
    <div className="flex max-h-[78dvh] flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/15 text-violet-200">
            <Headphones className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Audio stage</p>
            <p className="text-[10px] text-white/30">{speakers.length}/{seatCount} live</p>
          </div>
        </div>
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-violet-400 transition-all duration-500"
            style={{ width: `${Math.min((speakers.length / seatCount) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center justify-center gap-4">
          {Array.from({ length: seatCount }).map((_, index) => {
            const speaker = speakers[index];

            return (
              <div
                key={speaker?.userId ?? `empty-${index}`}
                className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${
                    speaker
                      ? "bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-violet-300/20"
                      : "border border-dashed border-white/[0.10] bg-white/[0.02]"
                  }`}
                >
                  {speaker ? (
                    <>
                      <div className="absolute inset-1 rounded-full border border-emerald-300/20" />
                      <UserRound className="h-5 w-5 text-white/65" />
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0d0d12] bg-emerald-400 text-[#062513]">
                        <Mic className="h-2.5 w-2.5" />
                      </span>
                    </>
                  ) : (
                    <Headphones className="h-5 w-5 text-white/20" />
                  )}
                </div>

                <span className="max-w-[72px] truncate text-[10px] font-medium text-white/35">
                  {speaker ? `Guest ${index + 1}` : "Open"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <div className="px-5 pb-5 pt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
              Requests
            </span>
            {requests.length > 0 && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-200">
                {requests.length}
              </span>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-[11px] text-white/25">
              No pending requests
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request, index) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-250"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <Avatar
                    name={request.user?.name || "Viewer"}
                    src={request.user?.avatar ?? undefined}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-white/80">
                      {request.user?.name || "Viewer"}
                    </p>
                    <p className="truncate text-[9px] text-white/25">
                      {request.user?.public_id || request.user_id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onReject(request.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/40 transition hover:bg-white/[0.09] hover:text-white"
                    aria-label="Decline request"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onApprove(request.id)}
                    disabled={speakers.length >= seatCount}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_6px_18px_rgba(139,92,246,0.25)] transition hover:bg-violet-400 disabled:opacity-30"
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
        <div className="px-5 pb-5 pt-5">
          {pending ? (
            <div className="flex items-center justify-between rounded-2xl bg-amber-300/[0.05] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                <div>
                  <p className="text-[12px] font-semibold text-white/75">Request sent</p>
                  <p className="text-[9px] text-white/25">Waiting for the host</p>
                </div>
              </div>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white/25" />
            </div>
          ) : speakers.length >= seatCount ? (
            <div className="rounded-2xl bg-white/[0.025] px-4 py-3 text-center text-[11px] text-white/25">
              Stage is full
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequest}
              disabled={requestLoading}
              className="group flex w-full items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3.5 transition-all duration-200 hover:bg-violet-500/[0.12] active:scale-[0.99] disabled:opacity-40"
            >
              <div>
                <p className="text-[12px] font-semibold text-white/85">Request to speak</p>
                <p className="mt-0.5 text-[9px] text-white/25">
                  {seatCount - speakers.length} seat{seatCount - speakers.length === 1 ? "" : "s"} open
                </p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-violet-200 transition-transform duration-200 group-hover:translate-x-0.5">
                <Mic className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
