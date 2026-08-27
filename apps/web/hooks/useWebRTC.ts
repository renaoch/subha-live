import { useCallback, useEffect, useRef, useState } from "react";
import {
  roomsApi,
  type RoomMediaState,
  type RoomRecord,
} from "@/lib/api/rooms";
import {
  createPublishTracks,
  createTrackName,
  waitForFirstUsableCandidate,
  waitForHostMediaState,
  waitForPeerConnectionConnected,
} from "@/lib/webrtc-utils";

type SessionInfo = {
  sessionId: string;
  generation: number;
};

type Role = "host" | "viewer" | "speaker";

type PeerRole = "host" | "viewer" | "guest";

const MEDIA_POLL_MS = 2000;
const HEARTBEAT_MS = 15000;

function isPeerAlive(peer: RTCPeerConnection | null) {
  if (!peer) return false;

  return (
    peer.connectionState !== "closed" &&
    peer.signalingState !== "closed"
  );
}

function isConnected(peer: RTCPeerConnection | null) {
  return peer?.connectionState === "connected";
}

function safeClosePeer(peer: RTCPeerConnection | null) {
  if (!peer) return;

  try {
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;
    peer.onicecandidateerror = null;
    peer.close();
  } catch {
    // Peer may already be closed.
  }
}

/**
 * Serialize all SDP operations belonging to ONE PeerConnection.
 *
 * This is deliberately kept outside React state.
 * React state is for UI. WebRTC signaling state is not UI state.
 */
function createNegotiationQueue() {
  let chain = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const next = chain.then(operation);

      chain = next.then(
        () => undefined,
        () => undefined,
      );

      return next;
    },
  };
}

export function useWebRTC(
  room: RoomRecord | null,
  userId: string | null,
  cameraEnabled = true,
  micEnabled = true,
) {
  const isHost = Boolean(room && userId === room.host_id);

  // ---------------------------------------------------------------------------
  // React/UI state
  // ---------------------------------------------------------------------------

  const [hostPublishing, setHostPublishing] = useState(false);
  const [hostMediaReady, setHostMediaReady] = useState(false);
  const [viewerConnected, setViewerConnected] = useState(false);
  const [speakerPublishing, setSpeakerPublishing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaState, setMediaState] = useState<RoomMediaState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ---------------------------------------------------------------------------
  // Stable refs
  // ---------------------------------------------------------------------------

  const mountedRef = useRef(true);

  const localStreamRef = useRef<MediaStream | null>(null);

  const hostPeerRef = useRef<RTCPeerConnection | null>(null);
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const guestPeerRef = useRef<RTCPeerConnection | null>(null);

  const remoteStreamRef = useRef<MediaStream | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);

  const hostSessionRef = useRef<SessionInfo | null>(null);
  const viewerSessionRef = useRef<SessionInfo | null>(null);
  const guestSessionRef = useRef<SessionInfo | null>(null);

  /**
   * These sets represent media tracks that THIS PeerConnection has already
   * successfully subscribed to.
   *
   * They are not React state because changing them must never cause a render.
   */
  const hostSpeakerIdsRef = useRef<Set<string>>(new Set());
  const viewerSpeakerIdsRef = useRef<Set<string>>(new Set());

  /**
   * One negotiation queue per PeerConnection.
   *
   * No polling callback can start another SDP transaction while one is
   * already running.
   */
  const hostNegotiationRef = useRef(createNegotiationQueue());
  const viewerNegotiationRef = useRef(createNegotiationQueue());
  const guestNegotiationRef = useRef(createNegotiationQueue());

  /**
   * Operation-level guards.
   */
  const hostPublishInFlightRef = useRef(false);
  const viewerConnectInFlightRef = useRef(false);
  const guestPublishInFlightRef = useRef(false);

  const mediaPollInFlightRef = useRef(false);

  /**
   * Used to ignore stale async operations after room/user changes.
   */
  const lifecycleGenerationRef = useRef(0);

  // ---------------------------------------------------------------------------
  // ICE
  // ---------------------------------------------------------------------------

  const iceServersPromiseRef =
    useRef<Promise<RTCIceServer[]> | null>(null);

  const getIceServers = useCallback((): Promise<RTCIceServer[]> => {
    if (!iceServersPromiseRef.current) {
      iceServersPromiseRef.current = roomsApi
        .getTurnCredentials()
        .then((result) => {
          return [
            { urls: "stun:stun.cloudflare.com:3478" },
            ...(result.iceServers ?? []),
          ];
        })
        .catch((error) => {
          console.error(
            "[WebRTC] Failed to load TURN credentials. Using STUN only.",
            error,
          );

          return [
            {
              urls: "stun:stun.cloudflare.com:3478",
            },
          ];
        });
    }

    return iceServersPromiseRef.current;
  }, []);

  useEffect(() => {
    getIceServers().catch(() => {});
  }, [getIceServers]);

  // ---------------------------------------------------------------------------
  // Local media
  // ---------------------------------------------------------------------------

  const stopLocalMedia = useCallback(() => {
    const stream = localStreamRef.current;

    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Already stopped.
        }
      }
    }

    localStreamRef.current = null;

    if (mountedRef.current) {
      setLocalStream(null);
    }
  }, []);

  const ensureLocalPreview = useCallback(async () => {
    const existing = localStreamRef.current;

    if (existing) {
      return existing;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: "user",
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
    });

    localStreamRef.current = stream;

    if (mountedRef.current) {
      setLocalStream(stream);
    }

    return stream;
  }, []);

  // ---------------------------------------------------------------------------
  // Peer cleanup
  // ---------------------------------------------------------------------------

  const closeHostPeer = useCallback(() => {
    safeClosePeer(hostPeerRef.current);

    hostPeerRef.current = null;
    hostSessionRef.current = null;
    hostSpeakerIdsRef.current.clear();

    if (mountedRef.current) {
      setHostPublishing(false);
      setHostMediaReady(false);
    }
  }, []);

  const closeViewerPeer = useCallback(() => {
    safeClosePeer(viewerPeerRef.current);

    viewerPeerRef.current = null;
    viewerSessionRef.current = null;
    viewerSpeakerIdsRef.current.clear();

    remoteStreamRef.current = null;

    if (mountedRef.current) {
      setViewerConnected(false);
    }
  }, []);

  const closeGuestPeer = useCallback(() => {
    safeClosePeer(guestPeerRef.current);

    guestPeerRef.current = null;
    guestSessionRef.current = null;

    const stream = guestStreamRef.current;

    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Already stopped.
        }
      }
    }

    guestStreamRef.current = null;

    if (mountedRef.current) {
      setSpeakerPublishing(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Generic SDP helper
  // ---------------------------------------------------------------------------

  const createOfferAndWaitForIce = useCallback(
    async (peer: RTCPeerConnection) => {
      if (!isPeerAlive(peer)) {
        throw new Error("PeerConnection is no longer alive.");
      }

      if (peer.signalingState !== "stable") {
        throw new Error(
          `Cannot create offer while signalingState=${peer.signalingState}`,
        );
      }

      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);

      await waitForFirstUsableCandidate(peer);

      const description = peer.localDescription;

      if (!description?.sdp) {
        throw new Error("PeerConnection did not produce an SDP offer.");
      }

      return description.sdp;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // HOST PUBLISH
  // ---------------------------------------------------------------------------

  const publishHostMedia = useCallback(
    async (currentRoom: RoomRecord) => {
      if (hostPublishInFlightRef.current) {
        return;
      }

      hostPublishInFlightRef.current = true;

      const lifecycle = lifecycleGenerationRef.current;

      try {
        setMediaError("");
        setHostPublishing(false);
        setHostMediaReady(false);

        const stream = await ensureLocalPreview();

        if (lifecycle !== lifecycleGenerationRef.current) {
          return;
        }

        closeHostPeer();

        const peer = new RTCPeerConnection({
          iceServers: await getIceServers(),
          bundlePolicy: "max-bundle",
        });

        hostPeerRef.current = peer;

        peer.onconnectionstatechange = () => {
          if (peer !== hostPeerRef.current) {
            return;
          }

          console.log(
            "[WebRTC][HOST] connectionState:",
            peer.connectionState,
          );

          if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed"
          ) {
            if (mountedRef.current) {
              setHostPublishing(false);
              setHostMediaReady(false);
            }
          }
        };

        const transceivers: Array<{
          transceiver: RTCRtpTransceiver;
          track: MediaStreamTrack;
          trackName: string;
        }> = [];

        for (const track of stream.getTracks()) {
          const transceiver = peer.addTransceiver(track, {
            direction: "sendonly",
          });

          transceivers.push({
            transceiver,
            track,
            trackName: createTrackName(
              track.kind === "video" ? "video" : "audio",
              userId ?? "host",
            ),
          });
        }

        /**
         * IMPORTANT:
         *
         * Host media is published in ONE browser offer.
         *
         * We do NOT immediately manufacture a second offer against the same
         * PeerConnection.
         */
        const offerSdp = await createOfferAndWaitForIce(peer);

        const tracks = createPublishTracks(transceivers);

        const result = await roomsApi.publishHost(currentRoom.id, {
          offerSdp,
          tracks,
        });

        if (!result.answerSdp) {
          throw new Error(
            "Cloudflare did not return the host SDP answer.",
          );
        }

        await peer.setRemoteDescription({
          type: "answer",
          sdp: result.answerSdp,
        });

        await waitForPeerConnectionConnected(peer, 20000, 400);

        if (lifecycle !== lifecycleGenerationRef.current) {
          return;
        }

        hostSessionRef.current = {
          sessionId: result.session.sessionId,
          generation: result.session.generation,
        };

        const state = await waitForHostMediaState(
          currentRoom.id,
          10000,
          400,
        );

        if (
          !state.host ||
          state.host.sessionId !== result.session.sessionId
        ) {
          throw new Error("Host media state was not registered.");
        }

        if (mountedRef.current) {
          setHostMediaReady(true);
          setHostPublishing(true);
        }

        console.log("[WebRTC][HOST] publish complete");
      } catch (error) {
        console.error("[WebRTC][HOST] publish failed", error);

        closeHostPeer();

        if (mountedRef.current) {
          setMediaError(
            error instanceof Error
              ? error.message
              : "Host media could not be connected.",
          );
        }

        throw error;
      } finally {
        hostPublishInFlightRef.current = false;
      }
    },
    [
      closeHostPeer,
      createOfferAndWaitForIce,
      ensureLocalPreview,
      getIceServers,
      userId,
    ],
  );

  // ---------------------------------------------------------------------------
  // VIEWER CONNECT
  // ---------------------------------------------------------------------------

  const connectViewer = useCallback(
    async (currentRoom: RoomRecord) => {
      if (viewerConnectInFlightRef.current) {
        return;
      }

      if (isConnected(viewerPeerRef.current)) {
        return;
      }

      viewerConnectInFlightRef.current = true;

      const lifecycle = lifecycleGenerationRef.current;

      try {
        setMediaError("");

        const state = await waitForHostMediaState(
          currentRoom.id,
          20000,
          500,
        );

        if (
          !state.host ||
          state.host.status !== "connected"
        ) {
          throw new Error(
            "Host is still connecting. Try again.",
          );
        }

        closeViewerPeer();

        const peer = new RTCPeerConnection({
          iceServers: await getIceServers(),
          bundlePolicy: "max-bundle",
        });

        viewerPeerRef.current = peer;

        const remoteStream = new MediaStream();

        remoteStreamRef.current = remoteStream;

        peer.ontrack = (event) => {
          if (peer !== viewerPeerRef.current) {
            return;
          }

          const tracks =
            event.streams[0]?.getTracks() ?? [event.track];

          for (const track of tracks) {
            if (
              !remoteStream
                .getTracks()
                .some((existing) => existing.id === track.id)
            ) {
              remoteStream.addTrack(track);
            }
          }
        };

        peer.onconnectionstatechange = () => {
          if (peer !== viewerPeerRef.current) {
            return;
          }

          const connected =
            peer.connectionState === "connected";

          if (mountedRef.current) {
            setViewerConnected(connected);
          }

          if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed"
          ) {
            if (mountedRef.current) {
              setViewerConnected(false);
            }
          }
        };

        /**
         * Reserve the initial media sections.
         *
         * This is the ONLY place where the initial viewer transceivers
         * are created.
         */
        peer.addTransceiver("video", {
          direction: "recvonly",
        });

        peer.addTransceiver("audio", {
          direction: "recvonly",
        });

        const connectedSpeakers = Object.entries(
          state.speakers,
        ).filter(
          ([, speaker]) =>
            speaker.status === "connected",
        );

        for (const [, speaker] of connectedSpeakers) {
          peer.addTransceiver("audio", {
            direction: "recvonly",
          });

          if (speaker.videoTrackName) {
            peer.addTransceiver("video", {
              direction: "recvonly",
            });
          }
        }

        const initialSpeakerIds = new Set(
          connectedSpeakers.map(([id]) => id),
        );

        viewerSpeakerIdsRef.current = initialSpeakerIds;

        /**
         * ONE initial viewer negotiation.
         */
        const offerSdp =
          await createOfferAndWaitForIce(peer);

        const result =
          await roomsApi.createViewerSession(
            currentRoom.id,
            offerSdp,
          );

        if (!result.answerSdp) {
          throw new Error(
            "Viewer session did not return an SDP answer.",
          );
        }

        await peer.setRemoteDescription({
          type: "answer",
          sdp: result.answerSdp,
        });

        await waitForPeerConnectionConnected(
          peer,
          20000,
          400,
        );

        if (
          lifecycle !== lifecycleGenerationRef.current
        ) {
          return;
        }

        viewerSessionRef.current = {
          sessionId: result.session.sessionId,
          generation: result.session.generation,
        };

        if (mountedRef.current) {
          setViewerConnected(true);
        }

        console.log(
          "[WebRTC][VIEWER] initial session connected",
          {
            sessionId: result.session.sessionId,
            speakers: [...initialSpeakerIds],
          },
        );
      } catch (error) {
        console.error(
          "[WebRTC][VIEWER] connect failed",
          error,
        );

        closeViewerPeer();

        if (mountedRef.current) {
          setMediaError(
            error instanceof Error
              ? error.message
              : "Viewer connection failed.",
          );
        }

        throw error;
      } finally {
        viewerConnectInFlightRef.current = false;
      }
    },
    [
      closeViewerPeer,
      createOfferAndWaitForIce,
      getIceServers,
    ],
  );

  // ---------------------------------------------------------------------------
  // GUEST / SPEAKER PUBLISH
  // ---------------------------------------------------------------------------

  const publishGuestAudio = useCallback(async () => {
    if (!room || isHost) {
      return;
    }

    if (guestPublishInFlightRef.current) {
      return;
    }

    if (isConnected(guestPeerRef.current)) {
      return;
    }

    guestPublishInFlightRef.current = true;

    const lifecycle = lifecycleGenerationRef.current;

    try {
      setMediaError("");

      closeGuestPeer();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

      if (lifecycle !== lifecycleGenerationRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      guestStreamRef.current = stream;

      const peer = new RTCPeerConnection({
        iceServers: await getIceServers(),
        bundlePolicy: "max-bundle",
      });

      guestPeerRef.current = peer;

      peer.onconnectionstatechange = () => {
        if (peer !== guestPeerRef.current) {
          return;
        }

        console.log(
          "[WebRTC][SPEAKER] connectionState:",
          peer.connectionState,
        );

        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          if (mountedRef.current) {
            setSpeakerPublishing(false);
          }
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer !== guestPeerRef.current) {
          return;
        }

        console.log(
          "[WebRTC][SPEAKER] iceConnectionState:",
          peer.iceConnectionState,
        );
      };

      peer.onicecandidateerror = (event) => {
        console.warn(
          "[WebRTC][SPEAKER] ICE candidate error",
          {
            errorCode: event.errorCode,
            errorText: event.errorText,
            url: event.url,
          },
        );
      };

      const track = stream.getAudioTracks()[0];

      if (!track) {
        throw new Error(
          "Microphone track was not created.",
        );
      }

      /**
       * Exactly ONE audio transceiver.
       */
      const transceiver = peer.addTransceiver(
        track,
        {
          direction: "sendonly",
        },
      );

      const offerSdp =
        await createOfferAndWaitForIce(peer);

      const tracks = createPublishTracks([
        {
          transceiver,
          track,
          trackName: createTrackName(
            "audio",
            userId ?? "speaker",
          ),
        },
      ]);

      const result =
        await roomsApi.publishGuest(room.id, {
          offerSdp,
          tracks,
        });

      if (!result.answerSdp) {
        throw new Error(
          "Cloudflare did not return the speaker SDP answer.",
        );
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.answerSdp,
      });

      await waitForPeerConnectionConnected(
        peer,
        20000,
        400,
      );

      if (
        lifecycle !== lifecycleGenerationRef.current
      ) {
        return;
      }

      guestSessionRef.current = {
        sessionId: result.session.sessionId,
        generation: result.session.generation,
      };

      if (mountedRef.current) {
        setSpeakerPublishing(true);
      }

      console.log(
        "[WebRTC][SPEAKER] publish complete",
        result.session,
      );
    } catch (error) {
      console.error(
        "[WebRTC][SPEAKER] publish failed",
        error,
      );

      await room &&
        roomsApi
          .unpublishGuest(room.id)
          .catch(() => {});

      closeGuestPeer();

      if (mountedRef.current) {
        setMediaError(
          error instanceof Error
            ? error.message
            : "Microphone could not be connected.",
        );
      }

      throw error;
    } finally {
      guestPublishInFlightRef.current = false;
    }
  }, [
    closeGuestPeer,
    createOfferAndWaitForIce,
    getIceServers,
    isHost,
    room,
    userId,
  ]);

  // ---------------------------------------------------------------------------
  // HOST: subscribe to new speakers
  // ---------------------------------------------------------------------------

  const syncHostGuestAudio = useCallback(
    async (state: RoomMediaState) => {
      if (!room || !isHost) {
        return;
      }

      const peer = hostPeerRef.current;

      if (!peer || !isPeerAlive(peer)) {
        return;
      }

      if (!hostSessionRef.current) {
        return;
      }

      if (!hostMediaReady) {
        return;
      }

      const newSpeakers = Object.entries(
        state.speakers,
      )
        .filter(
          ([speakerId, speaker]) =>
            speaker.status === "connected" &&
            !hostSpeakerIdsRef.current.has(
              speakerId,
            ),
        )
        .map(([speakerId]) => speakerId);

      if (newSpeakers.length === 0) {
        return;
      }

      await hostNegotiationRef.current.run(
        async () => {
          /**
           * The state may have changed while this operation was waiting
           * in the queue. Re-check before touching SDP.
           */
          const currentPeer =
            hostPeerRef.current;

          if (
            !currentPeer ||
            currentPeer !== peer ||
            !isPeerAlive(currentPeer)
          ) {
            return;
          }

          const actualSpeakerIds =
            newSpeakers.filter(
              (id) =>
                !hostSpeakerIdsRef.current.has(id),
            );

          if (actualSpeakerIds.length === 0) {
            return;
          }

          /**
           * Add exactly one recvonly audio section per new speaker.
           */
          const addedTransceivers =
            actualSpeakerIds.map(() =>
              currentPeer.addTransceiver(
                "audio",
                {
                  direction: "recvonly",
                },
              ),
            );

          try {
            const offerSdp =
              await createOfferAndWaitForIce(
                currentPeer,
              );

            const result =
              await roomsApi.subscribeHostToGuests(
                room.id,
                {
                  offerSdp,
                  speakerIds:
                    actualSpeakerIds,
                },
              );

            if (result.alreadySubscribed) {
              for (const id of actualSpeakerIds) {
                hostSpeakerIdsRef.current.add(id);
              }

              return;
            }

            if (result.answerSdp) {
              await currentPeer.setRemoteDescription({
                type: "answer",
                sdp: result.answerSdp,
              });
            } else if (result.offerSdp) {
              await currentPeer.setRemoteDescription({
                type: "offer",
                sdp: result.offerSdp,
              });

              const answer =
                await currentPeer.createAnswer();

              await currentPeer.setLocalDescription(
                answer,
              );

              await waitForFirstUsableCandidate(
                currentPeer,
              );

              const localAnswer =
                currentPeer.localDescription;

              if (!localAnswer?.sdp) {
                throw new Error(
                  "Host subscription answer SDP was not created.",
                );
              }

              await roomsApi.subscribeHostToGuests(
                room.id,
                {
                  answerSdp:
                    localAnswer.sdp,
                  speakerIds:
                    actualSpeakerIds,
                },
              );
            } else {
              throw new Error(
                "Host subscription returned no SDP.",
              );
            }

            for (const id of actualSpeakerIds) {
              hostSpeakerIdsRef.current.add(id);
            }

            console.log(
              "[WebRTC][HOST] subscribed to speakers",
              actualSpeakerIds,
            );
          } catch (error) {
            /**
             * Do NOT mark failed speakers as subscribed.
             *
             * The next media-state reconciliation can retry them.
             */
            for (const id of actualSpeakerIds) {
              hostSpeakerIdsRef.current.delete(id);
            }

            /**
             * Only rollback if we are actually in have-local-offer.
             */
            if (
              currentPeer.signalingState ===
              "have-local-offer"
            ) {
              try {
                await currentPeer.setLocalDescription({
                  type: "rollback",
                });
              } catch {
                // If rollback fails, the next lifecycle reset
                // will close this PeerConnection.
              }
            }

            for (const transceiver of addedTransceivers) {
              try {
                transceiver.stop();
              } catch {
                // Already stopped.
              }
            }

            throw error;
          }
        },
      );
    },
    [
      createOfferAndWaitForIce,
      hostMediaReady,
      isHost,
      room,
    ],
  );

  // ---------------------------------------------------------------------------
  // VIEWER: subscribe to new speakers
  // ---------------------------------------------------------------------------

  const syncViewerSpeakerAudio = useCallback(
    async (state: RoomMediaState) => {
      if (!room || isHost) {
        return;
      }

      const peer = viewerPeerRef.current;

      if (!peer || !isPeerAlive(peer)) {
        return;
      }

      if (!viewerSessionRef.current) {
        return;
      }

      if (!isConnected(peer)) {
        return;
      }

      const newSpeakers = Object.entries(
        state.speakers,
      )
        .filter(
          ([speakerId, speaker]) =>
            speaker.status === "connected" &&
            !viewerSpeakerIdsRef.current.has(
              speakerId,
            ),
        )
        .map(([speakerId]) => speakerId);

      if (newSpeakers.length === 0) {
        return;
      }

      await viewerNegotiationRef.current.run(
        async () => {
          const currentPeer =
            viewerPeerRef.current;

          if (
            !currentPeer ||
            currentPeer !== peer ||
            !isPeerAlive(currentPeer)
          ) {
            return;
          }

          if (
            currentPeer.signalingState !== "stable"
          ) {
            /**
             * Do not stack another offer on top of an existing
             * negotiation.
             *
             * The queue should normally prevent this, but this guard
             * makes the invariant explicit.
             */
            return;
          }

          const actualSpeakerIds =
            newSpeakers.filter(
              (id) =>
                !viewerSpeakerIdsRef.current.has(id),
            );

          if (actualSpeakerIds.length === 0) {
            return;
          }

          /**
           * One recvonly audio transceiver per new speaker.
           *
           * We do NOT touch existing transceivers.
           */
          const addedTransceivers =
            actualSpeakerIds.map(() =>
              currentPeer.addTransceiver(
                "audio",
                {
                  direction: "recvonly",
                },
              ),
            );

          try {
            const offerSdp =
              await createOfferAndWaitForIce(
                currentPeer,
              );

            const result =
              await roomsApi.subscribeViewerToSpeakers(
                room.id,
                {
                  offerSdp,
                  speakerIds:
                    actualSpeakerIds,
                },
              );

            if (result.alreadySubscribed) {
              for (const id of actualSpeakerIds) {
                viewerSpeakerIdsRef.current.add(id);
              }

              return;
            }

            if (result.answerSdp) {
              await currentPeer.setRemoteDescription({
                type: "answer",
                sdp: result.answerSdp,
              });
            } else if (result.offerSdp) {
              await currentPeer.setRemoteDescription({
                type: "offer",
                sdp: result.offerSdp,
              });

              const answer =
                await currentPeer.createAnswer();

              await currentPeer.setLocalDescription(
                answer,
              );

              await waitForFirstUsableCandidate(
                currentPeer,
              );

              const localAnswer =
                currentPeer.localDescription;

              if (!localAnswer?.sdp) {
                throw new Error(
                  "Viewer subscription answer SDP was not created.",
                );
              }

              await roomsApi.subscribeViewerToSpeakers(
                room.id,
                {
                  answerSdp:
                    localAnswer.sdp,
                  speakerIds:
                    actualSpeakerIds,
                },
              );
            } else {
              throw new Error(
                "Viewer subscription returned no SDP.",
              );
            }

            for (const id of actualSpeakerIds) {
              viewerSpeakerIdsRef.current.add(id);
            }

            console.log(
              "[WebRTC][VIEWER] subscribed to speakers",
              actualSpeakerIds,
            );
          } catch (error) {
            for (const id of actualSpeakerIds) {
              viewerSpeakerIdsRef.current.delete(id);
            }

       const signalingState =
  currentPeer.signalingState;

if (signalingState !== "stable") {
  try {
    await currentPeer.setLocalDescription({
      type: "rollback",
    });
  } catch {
    // The PeerConnection may already have moved
    // to another signaling state or failed.
  }
}

            for (const transceiver of addedTransceivers) {
              try {
                transceiver.stop();
              } catch {
                // Already stopped.
              }
            }

            throw error;
          }
        },
      );
    },
    [
      createOfferAndWaitForIce,
      isHost,
      room,
    ],
  );

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      !isHost ||
      room?.status !== "created"
    ) {
      return;
    }

    ensureLocalPreview().catch((error) => {
      if (!mountedRef.current) {
        return;
      }

      setMediaError(
        error instanceof Error
          ? error.message
          : "Camera or microphone permission was denied.",
      );
    });
  }, [
    ensureLocalPreview,
    isHost,
    room?.status,
  ]);

  // ---------------------------------------------------------------------------
  // Camera toggle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    for (const track of stream.getVideoTracks()) {
      track.enabled = cameraEnabled;
    }
  }, [cameraEnabled]);

  // ---------------------------------------------------------------------------
  // Microphone toggle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    for (const track of stream.getAudioTracks()) {
      track.enabled = micEnabled;
    }
  }, [micEnabled]);

  // ---------------------------------------------------------------------------
  // MEDIA STATE POLLER
  //
  // Important:
  //
  // This effect ONLY observes room media state.
  //
  // It does not depend on viewerConnected/speakerPublishing/etc.
  // Therefore the interval itself is stable and cannot be recreated just
  // because React state changed.
  // ---------------------------------------------------------------------------

  const mediaStateRef =
    useRef<RoomMediaState | null>(null);

  useEffect(() => {
    mediaStateRef.current = mediaState;
  }, [mediaState]);

  useEffect(() => {
    if (
      !room ||
      room.status !== "live"
    ) {
      return;
    }

    let active = true;

    const roomId = room.id;
    const currentUserId = userId;
    const currentIsHost = isHost;

    const poll = async () => {
      if (!active) {
        return;
      }

      if (mediaPollInFlightRef.current) {
        return;
      }

      mediaPollInFlightRef.current = true;

      try {
        const state =
          await roomsApi.getMediaState(roomId);

        if (!active) {
          return;
        }

        mediaStateRef.current = state;
        setMediaState(state);

        // ---------------------------------------------------------------
        // HOST
        // ---------------------------------------------------------------

        if (currentIsHost) {
          const hostSession =
            hostSessionRef.current;

          if (
            state.host &&
            state.host.userId === currentUserId
          ) {
            if (
              hostSession &&
              state.host.sessionId ===
                hostSession.sessionId &&
              state.host.status === "connected"
            ) {
              setHostMediaReady(true);
              setHostPublishing(true);
            }

            /**
             * Reconcile guest speakers.
             *
             * The reconciliation function owns the WebRTC negotiation
             * queue. The poller merely asks it to reconcile.
             */
            await syncHostGuestAudio(state);
          }

          return;
        }

        // ---------------------------------------------------------------
        // SPEAKER
        // ---------------------------------------------------------------

        const mySpeaker =
          currentUserId
            ? state.speakers[currentUserId]
            : undefined;

        if (
          mySpeaker &&
          (
            mySpeaker.status ===
              "connecting" ||
            mySpeaker.status ===
              "connected"
          ) &&
          !guestPeerRef.current
        ) {
          await publishGuestAudio().catch(
            (error) => {
              console.error(
                "[WebRTC] automatic speaker publish failed",
                error,
              );
            },
          );
        }

        // ---------------------------------------------------------------
        // VIEWER
        // ---------------------------------------------------------------

        if (
          viewerSessionRef.current &&
          isConnected(
            viewerPeerRef.current,
          )
        ) {
          await syncViewerSpeakerAudio(
            state,
          );
        }
      } catch (error) {
        if (active) {
          console.warn(
            "[WebRTC] media-state poll failed",
            error,
          );
        }
      } finally {
        mediaPollInFlightRef.current = false;
      }
    };

    void poll();

    const timer = window.setInterval(
      () => {
        void poll();
      },
      MEDIA_POLL_MS,
    );

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    isHost,
    room?.id,
    room?.status,
    userId,
    publishGuestAudio,
    syncHostGuestAudio,
    syncViewerSpeakerAudio,
  ]);

  // ---------------------------------------------------------------------------
  // HEARTBEAT
  //
  // One stable heartbeat loop instead of three React effects whose
  // dependencies change whenever media state changes.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!room) {
      return;
    }

    const roomId = room.id;

    const heartbeat = () => {
      if (isHost) {
        const session =
          hostSessionRef.current;

        if (session) {
          void roomsApi.heartbeat(
            roomId,
            {
              role: "host",
              sessionId:
                session.sessionId,
              generation:
                session.generation,
            },
          ).catch(() => {});
        }

        return;
      }

      const viewerSession =
        viewerSessionRef.current;

      if (viewerSession) {
        void roomsApi.heartbeat(
          roomId,
          {
            role: "viewer",
            sessionId:
              viewerSession.sessionId,
            generation:
              viewerSession.generation,
          },
        ).catch(() => {});
      }

      const speakerSession =
        guestSessionRef.current;

      if (speakerSession) {
        void roomsApi.heartbeat(
          roomId,
          {
            role: "speaker",
            sessionId:
              speakerSession.sessionId,
            generation:
              speakerSession.generation,
          },
        ).catch(() => {});
      }
    };

    const timer = window.setInterval(
      heartbeat,
      HEARTBEAT_MS,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    isHost,
    room?.id,
  ]);

  // ---------------------------------------------------------------------------
  // START HOST
  // ---------------------------------------------------------------------------

  const startHost = useCallback(
    async (currentRoom: RoomRecord) => {
      setMediaError("");
      setHostPublishing(false);
      setHostMediaReady(false);

      let startedRoom = false;

      try {
        await ensureLocalPreview();

        const liveRoom =
          currentRoom.status === "created"
            ? await roomsApi.start(
                currentRoom.id,
              )
            : currentRoom;

        startedRoom =
          currentRoom.status === "created";

        await publishHostMedia(
          liveRoom,
        );
      } catch (error) {
        if (startedRoom) {
          await roomsApi
            .end(currentRoom.id)
            .catch(() => {});
        }

        closeHostPeer();
        stopLocalMedia();

        if (mountedRef.current) {
          setHostPublishing(false);
          setHostMediaReady(false);
          setMediaError(
            error instanceof Error
              ? error.message
              : "Start failed.",
          );
        }

        throw error;
      }
    },
    [
      closeHostPeer,
      ensureLocalPreview,
      publishHostMedia,
      stopLocalMedia,
    ],
  );

  // ---------------------------------------------------------------------------
  // JOIN VIEWER
  // ---------------------------------------------------------------------------

  const joinViewer = useCallback(
    async (currentRoom: RoomRecord) => {
      setMediaError("");

      try {
        await connectViewer(
          currentRoom,
        );
      } catch (error) {
        if (mountedRef.current) {
          setMediaError(
            error instanceof Error
              ? error.message
              : "Join failed.",
          );
        }

        throw error;
      }
    },
    [connectViewer],
  );

  // ---------------------------------------------------------------------------
  // LEAVE
  // ---------------------------------------------------------------------------

  const leave = useCallback(async () => {
    /**
     * Invalidate every outstanding async operation.
     */
    lifecycleGenerationRef.current += 1;

    const currentRoom = room;
    const currentIsHost = isHost;

    try {
      if (viewerSessionRef.current && currentRoom) {
        await roomsApi
          .leaveViewer(currentRoom.id)
          .catch(() => {});
      }

      if (
        guestSessionRef.current &&
        currentRoom
      ) {
        await roomsApi
          .unpublishGuest(
            currentRoom.id,
          )
          .catch(() => {});
      }

      if (
        currentIsHost &&
        currentRoom &&
        currentRoom.status === "live"
      ) {
        await roomsApi
          .end(currentRoom.id)
          .catch(() => {});
      }
    } finally {
      closeViewerPeer();
      closeGuestPeer();
      closeHostPeer();
      stopLocalMedia();

      if (mountedRef.current) {
        setHostPublishing(false);
        setHostMediaReady(false);
        setViewerConnected(false);
        setSpeakerPublishing(false);
        setMediaState(null);
        setMediaError("");
      }
    }
  }, [
    closeGuestPeer,
    closeHostPeer,
    closeViewerPeer,
    isHost,
    room,
    stopLocalMedia,
  ]);

  // ---------------------------------------------------------------------------
  // ROOM / USER CHANGE
  //
  // A PeerConnection belongs to a specific room/user lifecycle.
  // Do not carry it into another room.
  // ---------------------------------------------------------------------------

  const previousRoomIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    const currentRoomId =
      room?.id ?? null;

    if (
      previousRoomIdRef.current !== null &&
      previousRoomIdRef.current !==
        currentRoomId
    ) {
      lifecycleGenerationRef.current += 1;

      closeViewerPeer();
      closeGuestPeer();
      closeHostPeer();

      mediaStateRef.current = null;
      setMediaState(null);
    }

    previousRoomIdRef.current =
      currentRoomId;
  }, [
    closeGuestPeer,
    closeHostPeer,
    closeViewerPeer,
    room?.id,
  ]);

  // ---------------------------------------------------------------------------
  // UNMOUNT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      lifecycleGenerationRef.current += 1;

      safeClosePeer(
        hostPeerRef.current,
      );
      safeClosePeer(
        viewerPeerRef.current,
      );
      safeClosePeer(
        guestPeerRef.current,
      );

      hostPeerRef.current = null;
      viewerPeerRef.current = null;
      guestPeerRef.current = null;

      const streams = [
        localStreamRef.current,
        guestStreamRef.current,
      ];

      for (const stream of streams) {
        if (!stream) continue;

        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // Already stopped.
          }
        }
      }

      localStreamRef.current = null;
      guestStreamRef.current = null;
      remoteStreamRef.current = null;

      hostSessionRef.current = null;
      viewerSessionRef.current = null;
      guestSessionRef.current = null;

      hostSpeakerIdsRef.current.clear();
      viewerSpeakerIdsRef.current.clear();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    hostPublishing,
    hostMediaReady,
    viewerConnected,
    speakerPublishing,
    mediaError,
    mediaState,
    localStream,

    localStreamRef,
    remoteStreamRef,

    startHost,
    joinViewer,
    leave,
    publishGuestAudio,
  };
}