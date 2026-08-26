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
  SlidersHorizontal,
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

/*
 * Cloudflare Realtime is negotiated with a single one-shot REST call
 * (offer in, answer out) — there's no persistent signaling channel to
 * trickle individual candidates to it afterwards. Given that, the
 * fastest *and* most load-friendly option is to send the SDP as soon
 * as we have at least one usable candidate, rather than waiting for
 * ICE gathering to fully finish:
 *
 *   - A host or server-reflexive candidate almost always shows up
 *     within the first 100-300ms. TURN/relay candidates (needed only
 *     for the minority of viewers behind symmetric NATs) can take a
 *     couple of seconds — waiting for those on every single join was
 *     the actual source of the multi-second delay, even though most
 *     connections never needed them.
 *   - The browser keeps gathering in the background after we send;
 *     if a better (relay) candidate shows up slightly later it's
 *     simply not offered to Cloudflare on this negotiation, so a
 *     viewer whose host/srflx candidate doesn't end up reachable
 *     falls back to the short safety timeout below and reconnects on
 *     the next attempt rather than blocking everyone else's join.
 *
 * This adds no server-side state at all (no websocket, no sticky
 * sessions, no per-connection memory on the API), so it scales with
 * traffic exactly as well as the existing REST calls do — unlike a
 * real signaling channel, which would need one held-open connection
 * per active user plus Redis fan-out across API replicas to work
 * behind a load balancer.
 */
function waitForFirstUsableCandidate(
  peer: RTCPeerConnection,
  timeoutMs = 1200,
): Promise<void> {
  if (
    peer.iceGatheringState === "complete" ||
    peer.localDescription?.sdp.includes("a=candidate")
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      peer.removeEventListener("icecandidate", onCandidate);
      peer.removeEventListener(
        "icegatheringstatechange",
        onStateChange,
      );
      window.clearTimeout(timer);
      resolve();
    };

    const onCandidate = (
      event: RTCPeerConnectionIceEvent,
    ) => {
      // A null candidate signals gathering is complete with nothing
      // more coming; any real candidate is immediately usable.
      if (event.candidate || event.candidate === null) {
        finish();
      }
    };

    const onStateChange = () => {
      if (peer.iceGatheringState !== "new") {
        finish();
      }
    };

    peer.addEventListener("icecandidate", onCandidate);
    peer.addEventListener(
      "icegatheringstatechange",
      onStateChange,
    );

    // Safety net: never block the join/publish flow longer than this,
    // even on a network where gathering is unusually slow.
    const timer = window.setTimeout(finish, timeoutMs);
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

  const [filterOpen, setFilterOpen] =
    useState(false);

  const [selectedFilter, setSelectedFilter] =
    useState("Natural");

  const filterPresets = {
    Natural: "none",
    Glow: "brightness(1.08) saturate(1.08) contrast(0.96)",
    Warm: "sepia(0.16) saturate(1.18) brightness(1.04)",
    Cool: "hue-rotate(10deg) saturate(0.88) brightness(1.04)",
    Noir: "grayscale(1) contrast(1.18) brightness(0.94)",
    Vintage: "sepia(0.28) saturate(0.82) contrast(0.94) brightness(1.04)",
  } as const;

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

  const [guestMicEnabled, setGuestMicEnabled] =
    useState(true);

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
    setGuestMicEnabled(true);

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
    await waitForFirstUsableCandidate(peer);

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
    await waitForFirstUsableCandidate(peer);

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

    // Track which ids we attempted this round so we can roll back on
    // failure instead of leaving them permanently marked as "handled".
    const attemptedIds: string[] = [];

    // Track the transceivers we add this round so a failed negotiation
    // can be cleanly undone instead of leaving orphaned m-lines behind.
    // Without this, a failed sync would retry every poll cycle and pile
    // up a new recvonly transceiver each time for the same speaker,
    // since transceivers can't be removed from an RTCPeerConnection —
    // only stopped.
    const addedTransceivers: RTCRtpTransceiver[] = [];

    try {
      for (const speakerId of speakerIds) {
        const transceiver = peer.addTransceiver("audio", { direction: "recvonly" });
        addedTransceivers.push(transceiver);
        attemptedIds.push(speakerId);
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error("Host guest-audio SDP was not created.");

      const result = await roomsApi.subscribeHostToGuests(currentRoom.id, {
        offerSdp: localDescription.sdp,
        speakerIds: attemptedIds,
      });

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
      } else if (result.offerSdp) {
        await peer.setRemoteDescription({ type: "offer", sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForFirstUsableCandidate(peer);
        const localAnswer = peer.localDescription;
        if (!localAnswer?.sdp) throw new Error("Host guest-audio answer was not created.");
        await roomsApi.subscribeHostToGuests(currentRoom.id, {
          answerSdp: localAnswer.sdp,
          speakerIds: attemptedIds,
        });
      } else {
        throw new Error("Host guest-audio negotiation returned no SDP.");
      }

      // Only now that negotiation fully succeeded do we mark these ids done.
      for (const speakerId of attemptedIds) {
        hostSpeakerIdsRef.current.add(speakerId);
      }
    } catch (error) {
      // If any step fails, we roll back the attempted ids so the next
      // poll cycle will try these speakers again.
      for (const speakerId of attemptedIds) {
        hostSpeakerIdsRef.current.delete(speakerId);
      }

      // Undo the transceivers we just added so retries don't pile up
      // duplicate recvonly m-lines for the same speaker.
      for (const transceiver of addedTransceivers) {
        try {
          transceiver.stop();
        } catch {
          // Older browsers may not support stop() on a transceiver
          // that never reached "sendrecv" — safe to ignore.
        }
      }

      // Return the peer's signaling state to "stable" so the next
      // createOffer()/setLocalDescription() call isn't left dangling
      // on a half-finished "have-local-offer" negotiation.
      if (peer.signalingState !== "stable") {
        try {
          await peer.setLocalDescription({ type: "rollback" });
        } catch {
          // If rollback itself fails the connection is in a bad
          // state; closeHostPeer()/reconnect logic upstream will
          // recover it on the next full sync pass.
        }
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
    await waitForFirstUsableCandidate(peer);

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

      await waitForFirstUsableCandidate(peer);

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

    await waitForFirstUsableCandidate(
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

    await waitForFirstUsableCandidate(
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
          .catch(() => { });
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

    await waitForFirstUsableCandidate(
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

    await waitForFirstUsableCandidate(
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

      await waitForFirstUsableCandidate(
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
        // Keep the preview usable when the production room API is not configured.
        setRoom({
          id: id || "demo-room",
          title: "Subha Live",
          host_id: "demo-host",
          status: "live",
          category: "Community",
          cover: "/image.png",
          description: "This stream is awesome!",
          livekit_room_name: "demo-room",
          max_guest_slots: 3,
          host: {
            id: "demo-host",
            name: "Subha",
            handle: "subha",
            avatar: "/image.png",
            country_flag: null,
          },
          viewerCount: 1200,
          mediaType: "video",
        });
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

        /*
         * `state.speakers` (above) reflects the SFU publish state,
         * which only becomes true AFTER the viewer has published a
         * track — it can never be used to detect that the host has
         * approved the request in the first place. Poll the request
         * status directly (backed by room_join_requests) so
         * "requestPending" clears the moment the host accepts, even
         * before the guest's microphone track has been published.
         */
        let myRequestAccepted = false;
        if (!isHost && !state.speakers[userId ?? ""] && requestPending) {
          try {
            const myStatus = await roomsApi.getMyRequestStatus(id);
            if (!active) return;

            if (myStatus.status === "accepted") {
              myRequestAccepted = true;
              setRequestPending(false);
              if (!speakerApprovalSeenRef.current) {
                speakerApprovalSeenRef.current = true;
                toast.success("Your audio seat was accepted");
              }
            } else if (
              myStatus.status === "rejected" ||
              myStatus.status === "cancelled" ||
              myStatus.status === "none"
            ) {
              setRequestPending(false);
            }
          } catch (error) {
            console.error("Failed to fetch speak request status", error);
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
          if (
            (state.speakers[userId ?? ""] || myRequestAccepted) &&
            !speakerPublishing &&
            !mediaBusy
          ) {
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
   * The 3s room-status poll (above, in the room-load effect) does
   * pick up "ended", but nothing previously acted on that value for
   * non-host participants: their peer connections stayed open and
   * they were never navigated out. Tear the viewer down and send
   * them home as soon as the host ends the room.
   */
  const roomEndHandledRef = useRef(false);

  useEffect(() => {
    if (!room || isHost) return;

    if (room.status === "ended") {
      if (roomEndHandledRef.current) return;
      roomEndHandledRef.current = true;

      toast.info("The host ended this live");
      void handleLeave();
    } else {
      roomEndHandledRef.current = false;
    }
  }, [room?.status, isHost]);

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
   * Guest speaker's own mic mute/unmute. Mirrors the host mic
   * effect above but drives the guest publish stream instead of
   * the host's local stream.
   */
  useEffect(() => {
    guestStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = guestMicEnabled;
      });
  }, [guestMicEnabled]);

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
            .catch(() => { });
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
            .catch(() => { });
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
      }).catch(() => { });
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
        await roomsApi.leaveViewer(id).catch(() => { });
      }

      if (speakerPublishing) {
        await roomsApi.unpublishGuest(id).catch(() => { });
      }

      if (joined) {
        await roomsApi
          .leave(id)
          .catch(() => { });
      }

      if (
        isHost &&
        room?.status ===
        "live"
      ) {
        await roomsApi
          .end(id)
          .catch(() => { });
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
      <section className="relative mx-auto h-[100svh] w-full max-w-[430px] overflow-hidden bg-black shadow-2xl">
        {/* Full-screen room media */}
        {isHost && isWaiting ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: filterPresets[selectedFilter as keyof typeof filterPresets] }}
            />
          ) : isHost && isLive ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: filterPresets[selectedFilter as keyof typeof filterPresets] }}
            />
        ) : isLive && mediaState?.host ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            controls={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#080808]" aria-label="Waiting for live video" />
        )}

        {/* Cinematic darkening exactly for the UI treatment */}
        <div className="pointer-events-none absolute inset-0 bg-black/35" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/80 via-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

        {mediaError && isHost && isWaiting && (
          <div className="absolute left-5 right-5 top-5 z-50 rounded-2xl border border-red-300/20 bg-black/70 px-4 py-3 text-xs text-red-100 backdrop-blur-xl">
            {mediaError}
          </div>
        )}

        {/* Minimal profile row */}
        <div className="absolute inset-x-0 top-0 z-30 px-5 pt-10">
          <div className="flex min-h-10 items-center gap-3">
            <Avatar
              name={hostName}
              src={room.host?.avatar ?? undefined}
              size="md"
              online={isLive}
              className="h-9 w-9 shrink-0 border border-white/10"
            />

            <div className="ml-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[15px] font-medium leading-tight">{hostName}</p>
                <span className="flex h-3 w-3 items-center justify-center rounded-full bg-white text-black">
                  <span className="text-[8px] font-black leading-none">✓</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-tight text-white/50">{room.viewerCount ?? mediaState?.viewerCount ?? 1200} watching</p>
            </div>

            <button
              type="button"
              onClick={handleLeave}
              aria-label="Close room"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Sparse live comments */}
        <div className="absolute bottom-[92px] left-4 z-30 w-[min(220px,calc(100%-32px))] space-y-1.5">
          {[
            { name: "Riya", text: "This stream is awesome!" },
            { name: "Aman", text: "Keep going bro!" },
          ].map((comment) => (
            <div key={comment.name} className="flex items-center gap-2 rounded-full bg-black/35 px-2 py-1.5 backdrop-blur-md">
              <div className="h-6 w-6 shrink-0 rounded-full bg-white/15 ring-1 ring-white/10" />
              <p className="truncate text-xs"><span className="font-medium text-white/75">{comment.name}</span><span className="ml-2 text-white/90">{comment.text}</span></p>
            </div>
          ))}
        </div>

        {/* Vertical audio-stage button */}
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

        {/* Bottom interaction bar */}
        <div className="absolute inset-x-0 bottom-[10px] z-40 flex items-center gap-[5px] px-[14px]">
          <div className="flex h-[29px] min-w-0 flex-1 items-center rounded-full border border-white/10 bg-black/45 px-[10px] text-[13px] text-white/45 backdrop-blur-xl">
            Say something...
          </div>

          {[
            { label: "Share link", icon: <Link2 className="h-[15px] w-[15px]" strokeWidth={1.7} /> },
            { label: "Messages", icon: <Mail className="h-[15px] w-[15px]" strokeWidth={1.7} /> },
            { label: "Menu", icon: <Menu className="h-[16px] w-[16px]" strokeWidth={1.7} /> },
            ...(!isHost ? [{ label: "Gift", icon: <Gift className="h-[15px] w-[15px]" strokeWidth={1.7} /> }] : []),
          ].map((item) => (
            <button key={item.label} type="button" aria-label={item.label} className="flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/45 backdrop-blur-xl">
              {item.icon}
            </button>
          ))}

          <button type="button" aria-label="Like" className="flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full bg-white text-black">
            <ThumbsUp className="h-[14px] w-[14px]" strokeWidth={1.6} />
          </button>
        </div>

        {/* Host controls: camera stays on, while mic and a subtle beauty filter remain available. */}
        {isHost && (isWaiting || isLive) && (
          <div className="absolute left-1/2 bottom-[43px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 p-1.5 shadow-2xl backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => setMicEnabled((value) => !value)}
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition ${micEnabled ? "text-white hover:bg-white/10" : "bg-white text-black"}`}
              aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              title={micEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {micEnabled ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition ${filterOpen ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
              aria-label="Open streamer filters"
              aria-expanded={filterOpen}
              title="Streamer filters"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </button>
            {isWaiting && (
              <button
                type="button"
                onClick={handleStart}
                disabled={actionLoading || !localStreamRef.current}
                className="flex h-[34px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                <span>Start Live</span>
              </button>
            )}
          </div>
        )}

        {isHost && isLive && (
          <div className="absolute left-1/2 top-[46px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-semibold tracking-wide backdrop-blur-xl">
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${hostMediaReady ? "animate-pulse bg-red-400" : "animate-pulse bg-amber-300"}`} />
            {hostMediaReady ? "LIVE" : "CONNECTING"}
          </div>
        )}

        {isHost && filterOpen && (
          <div className="absolute bottom-[92px] left-1/2 z-50 w-[min(280px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/75 p-3 shadow-2xl backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-white">Streamer filter</p>
              <span className="text-[10px] text-white/45">Live preview</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(filterPresets).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={`rounded-xl border px-2 py-2 text-[11px] transition ${selectedFilter === filter ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
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
          <div className="absolute left-[15px] bottom-[154px] z-40 flex items-center gap-2">
            <div className="flex items-center rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[8px] font-semibold backdrop-blur-xl">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              You are speaking
            </div>

            <button
              type="button"
              onClick={() => setGuestMicEnabled((value) => !value)}
              className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition ${
                guestMicEnabled ? "bg-black/45 text-white hover:bg-white/10" : "bg-white text-black"
              }`}
              aria-label={guestMicEnabled ? "Mute microphone" : "Unmute microphone"}
              title={guestMicEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {guestMicEnabled ? (
                <Mic className="h-[13px] w-[13px]" />
              ) : (
                <MicOff className="h-[13px] w-[13px]" />
              )}
            </button>
          </div>
        )}

        {speakerMediaError && !isHost && (
          <div className="absolute left-[15px] right-[30px] bottom-[150px] z-50 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">
            {speakerMediaError}
          </div>
        )}

        {/* Audio stage modal */}
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
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <p className="text-[8px] font-semibold text-white">Audio stage</p>
        <p className="text-[8px] text-white/35">
          {speakers.length}/{seatCount}
        </p>
      </div>

      {/* Seats — flat row, no glow rings, minimal state changes */}
      <div className="flex items-center gap-1.5 px-5 pb-5">
        {Array.from({ length: seatCount }).map((_, index) => {
          const speaker = speakers[index];

          return (
            <div
              key={speaker?.userId ?? `empty-${index}`}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${speaker
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

      {/* Host: request list */}
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
