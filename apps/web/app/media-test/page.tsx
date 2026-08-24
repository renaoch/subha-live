"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { api } from "@/lib/api/client";

type TestStatus =
  | "idle"
  | "requesting-media"
  | "creating-peer-connection"
  | "creating-offer"
  | "creating-cloudflare-session"
  | "publishing-tracks"
  | "applying-cloudflare-answer"
  | "waiting-for-connection"
  | "connected"
  | "error"
  | "stopped";

interface CreateSessionResponse {
  status: "ok";

  data: {
    sessionId: string;

    roomId: string;

    userId: string;

    role: string;

    generation: number;

    status: string;

    sessionDescription?: {
      type: "offer" | "answer";

      sdp: string;
    };
  };
}

interface PublishTracksResponse {
  status: "ok";

  data: {
    answerSdp?: string;

    offerSdp?: string;

    tracks: Array<{
      trackName: string;

      kind: "audio" | "video";

      direction:
        | "publish"
        | "subscribe";
    }>;

    requiresRenegotiation: boolean;
  };
}

export default function MediaTestPage() {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const peerRef =
    useRef<RTCPeerConnection | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const [status, setStatus] =
    useState<TestStatus>("idle");

  const [error, setError] =
    useState("");

  const [sessionId, setSessionId] =
    useState("");

  const [iceState, setIceState] =
    useState(
      "new",
    );

  const [
    connectionState,
    setConnectionState,
  ] = useState(
    "new",
  );

  const [
    localDescriptionReady,
    setLocalDescriptionReady,
  ] = useState(false);

  async function start() {
    if (
      peerRef.current
    ) {
      return;
    }

    try {
      setError("");
      setSessionId("");
      setIceState("new");
      setConnectionState(
        "new",
      );
      setLocalDescriptionReady(
        false,
      );

      /*
       * ----------------------------------------------------------
       * 1. Get camera + microphone
       * ----------------------------------------------------------
       */

      setStatus(
        "requesting-media",
      );

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
            video: true,
          },
        );

      streamRef.current =
        stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;
      }

      /*
       * ----------------------------------------------------------
       * 2. Create PeerConnection
       * ----------------------------------------------------------
       */

      setStatus(
        "creating-peer-connection",
      );

      const peer =
        new RTCPeerConnection();

      peerRef.current =
        peer;

      peer.onconnectionstatechange =
        () => {
          console.log(
            "[media-test] connectionState:",
            peer.connectionState,
          );

          setConnectionState(
            peer.connectionState,
          );

          if (
            peer.connectionState ===
            "connected"
          ) {
            setStatus(
              "connected",
            );
          }

          if (
            peer.connectionState ===
              "failed" ||
            peer.connectionState ===
              "closed"
          ) {
            if (
              peer.connectionState ===
              "failed"
            ) {
              setStatus(
                "error",
              );
            }
          }
        };

      peer.oniceconnectionstatechange =
        () => {
          console.log(
            "[media-test] ICE:",
            peer.iceConnectionState,
          );

          setIceState(
            peer.iceConnectionState,
          );
        };

      peer.onicecandidate =
        (event) => {
          console.log(
            "[media-test] ICE candidate:",
            event.candidate,
          );
        };

      peer.onicegatheringstatechange =
        () => {
          console.log(
            "[media-test] ICE gathering:",
            peer.iceGatheringState,
          );
        };

      /*
       * ----------------------------------------------------------
       * 3. Add local media tracks
       * ----------------------------------------------------------
       */

      for (
        const track of
        stream.getTracks()
      ) {
        peer.addTrack(
          track,
          stream,
        );
      }

      /*
       * ----------------------------------------------------------
       * 4. Create SDP offer
       * ----------------------------------------------------------
       */

      setStatus(
        "creating-offer",
      );

      const offer =
        await peer.createOffer();

      await peer.setLocalDescription(
        offer,
      );

      /*
       * Wait until ICE gathering has completed.
       *
       * This gives us a complete SDP containing
       * the gathered ICE candidates.
       */

      await waitForIceGatheringComplete(
        peer,
      );

      const localDescription =
        peer.localDescription;

      if (
        !localDescription?.sdp
      ) {
        throw new Error(
          "Browser did not generate an SDP offer.",
        );
      }

      setLocalDescriptionReady(
        true,
      );

      console.log(
        "[media-test] Local SDP generated.",
      );

      /*
       * ----------------------------------------------------------
       * 5. Create Cloudflare session
       * ----------------------------------------------------------
       *
       * Session creation is separate from track
       * negotiation.
       */

      setStatus(
        "creating-cloudflare-session",
      );

      const session =
        await api.post<CreateSessionResponse>(
          "/api/v1/media/test/session",
          {
            roomId:
              "phase1-browser-test",
          },
        );

      const newSessionId =
        session.data.sessionId;

      if (!newSessionId) {
        throw new Error(
          "Cloudflare session ID was not returned.",
        );
      }

      setSessionId(
        newSessionId,
      );

      console.log(
        "[media-test] Cloudflare session:",
        newSessionId,
      );

      /*
       * ----------------------------------------------------------
       * 6. Send SDP + tracks to Cloudflare
       * ----------------------------------------------------------
       */

      setStatus(
        "publishing-tracks",
      );

      const tracks =
        await api.post<PublishTracksResponse>(
          "/api/v1/media/test/tracks",
          {
            sessionId:
              newSessionId,

            offerSdp:
              localDescription.sdp,

            tracks: [
              {
                trackName:
                  "phase1-test-video",

                kind:
                  "video",

                direction:
                  "publish",
              },

              {
                trackName:
                  "phase1-test-audio",

                kind:
                  "audio",

                direction:
                  "publish",
              },
            ],
          },
        );

      const answerSdp =
        tracks.data.answerSdp;

      if (!answerSdp) {
        throw new Error(
          "Cloudflare did not return an SDP answer.",
        );
      }

      console.log(
        "[media-test] Cloudflare SDP answer received.",
      );

      /*
       * ----------------------------------------------------------
       * 7. Apply Cloudflare SDP answer
       * ----------------------------------------------------------
       */

      setStatus(
        "applying-cloudflare-answer",
      );

      await peer.setRemoteDescription({
        type: "answer",

        sdp: answerSdp,
      });

      /*
       * ----------------------------------------------------------
       * 8. Wait for WebRTC connection
       * ----------------------------------------------------------
       */

      setStatus(
        "waiting-for-connection",
      );
    } catch (caughtError) {
      console.error(
        "[media-test]",
        caughtError,
      );

      setStatus(
        "error",
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : String(
              caughtError,
            ),
      );

      cleanupConnection();
    }
  }

  function stop() {
    cleanupConnection();

    setStatus(
      "stopped",
    );

    setConnectionState(
      "closed",
    );

    setIceState(
      "closed",
    );

    setSessionId("");

    setLocalDescriptionReady(
      false,
    );
  }

  function cleanupConnection() {
    const peer =
      peerRef.current;

    if (peer) {
      peer.onconnectionstatechange =
        null;

      peer.oniceconnectionstatechange =
        null;

      peer.onicecandidate =
        null;

      peer.onicegatheringstatechange =
        null;

      peer.close();

      peerRef.current =
        null;
    }

    const stream =
      streamRef.current;

    if (stream) {
      for (
        const track of
        stream.getTracks()
      ) {
        track.stop();
      }

      streamRef.current =
        null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }
  }

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  return (
    <main
      style={{
        minHeight:
          "100vh",

        padding:
          "40px",

        background:
          "#0a0a0a",

        color:
          "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth:
            "900px",

          margin:
            "0 auto",
        }}
      >
        <h1
          style={{
            fontSize:
              "32px",

            fontWeight:
              700,

            marginBottom:
              "8px",
          }}
        >
          Cloudflare Realtime
        </h1>

        <p
          style={{
            color:
              "#999",

            marginBottom:
              "30px",
          }}
        >
          Phase 1 WebRTC connectivity
          test
        </p>

        <section
          style={{
            padding:
              "20px",

            border:
              "1px solid #2a2a2a",

            borderRadius:
              "12px",

            marginBottom:
              "24px",
          }}
        >
          <StatusRow
            label="Status"
            value={status}
          />

          <StatusRow
            label="ICE state"
            value={iceState}
          />

          <StatusRow
            label="Connection state"
            value={
              connectionState
            }
          />

          <StatusRow
            label="Local SDP"
            value={
              localDescriptionReady
                ? "generated"
                : "not generated"
            }
          />

          {sessionId && (
            <div
              style={{
                marginTop:
                  "12px",
              }}
            >
              <div
                style={{
                  color:
                    "#888",

                  fontSize:
                    "13px",

                  marginBottom:
                    "4px",
                }}
              >
                Cloudflare Session
              </div>

              <code
                style={{
                  wordBreak:
                    "break-all",
                }}
              >
                {sessionId}
              </code>
            </div>
          )}
        </section>

        {error && (
          <section
            style={{
              padding:
                "16px",

              border:
                "1px solid #6b2222",

              background:
                "#210d0d",

              borderRadius:
                "10px",

              marginBottom:
                "24px",

              color:
                "#ff8b8b",
            }}
          >
            <strong>
              Error
            </strong>

            <pre
              style={{
                marginTop:
                  "8px",

                whiteSpace:
                  "pre-wrap",

                wordBreak:
                  "break-word",
              }}
            >
              {error}
            </pre>
          </section>
        )}

        <div
          style={{
            width:
              "640px",

            maxWidth:
              "100%",

            aspectRatio:
              "16 / 9",

            background:
              "#111",

            border:
              "1px solid #292929",

            borderRadius:
              "14px",

            overflow:
              "hidden",

            marginBottom:
              "24px",
          }}
        >
          <video
            ref={
              videoRef
            }
            autoPlay
            muted
            playsInline
            style={{
              width:
                "100%",

              height:
                "100%",

              objectFit:
                "cover",
            }}
          />
        </div>

        <div
          style={{
            display:
              "flex",

            gap:
              "12px",
          }}
        >
          <button
            type="button"
            onClick={
              start
            }
            disabled={
              status !==
                "idle" &&
              status !==
                "stopped" &&
              status !==
                "error"
            }
            style={{
              padding:
                "12px 20px",

              borderRadius:
                "8px",

              border:
                "none",

              background:
                "#ffffff",

              color:
                "#000000",

              fontWeight:
                600,

              cursor:
                "pointer",

              opacity:
                status !==
                  "idle" &&
                status !==
                  "stopped" &&
                status !==
                  "error"
                  ? 0.5
                  : 1,
            }}
          >
            Start WebRTC Test
          </button>

          <button
            type="button"
            onClick={
              stop
            }
            style={{
              padding:
                "12px 20px",

              borderRadius:
                "8px",

              border:
                "1px solid #333",

              background:
                "transparent",

              color:
                "#ffffff",

              cursor:
                "pointer",
            }}
          >
            Stop
          </button>
        </div>
      </div>
    </main>
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",

        justifyContent:
          "space-between",

        gap:
          "20px",

        padding:
          "8px 0",
      }}
    >
      <span
        style={{
          color:
            "#888",
        }}
      >
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function waitForIceGatheringComplete(
  peer: RTCPeerConnection,
): Promise<void> {
  if (
    peer.iceGatheringState ===
    "complete"
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve) => {
      const handleStateChange =
        () => {
          if (
            peer.iceGatheringState ===
            "complete"
          ) {
            peer.removeEventListener(
              "icegatheringstatechange",
              handleStateChange,
            );

            resolve();
          }
        };

      peer.addEventListener(
        "icegatheringstatechange",
        handleStateChange,
      );
    },
  );
}