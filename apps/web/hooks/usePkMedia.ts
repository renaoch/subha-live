"use client";

import { useEffect, useRef, useState } from "react";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import type { PkState } from "@/lib/api/pk";
import {
  waitForFirstUsableCandidate,
  waitForPeerConnectionConnected,
} from "@/lib/webrtc-utils";

const HEARTBEAT_MS = 15_000;

/**
 * Subscribes to the OPPONENT host's stream for a PK battle, entirely
 * client-side (no server transcoding). Reuses the existing viewer-session
 * endpoint against the opponent's room, so a viewer (or the host) receives
 * the other host's video/audio in a second RTCPeerConnection.
 *
 * The primary stream (own room) is handled by the existing useWebRTC hook;
 * this hook only adds the second stream.
 */
export function usePkMedia(
  room: RoomRecord | null,
  userId: string | null,
  pkState: PkState | null,
) {
  const [opponentStream, setOpponentStream] = useState<MediaStream | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [opponentRoomId, setOpponentRoomId] = useState<string | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sessionRef = useRef<{ sessionId: string; generation: number } | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Resolve the opponent's room while a battle is active.
  useEffect(() => {
    if (!room || !pkState) {
      setOpponentRoomId(null);
      return;
    }
    if (pkState.status !== "ACTIVE" && pkState.status !== "FINISHED" && pkState.status !== "FINALIZING") {
      setOpponentRoomId(null);
      return;
    }
    const other = pkState.roomA === room.id ? pkState.roomB : pkState.roomA;
    setOpponentRoomId(other && other !== room.id ? other : null);
  }, [room, pkState]);

  useEffect(() => {
    if (!opponentRoomId || !userId) return;

    let disposed = false;

    const connect = async () => {
      if (peerRef.current) return;

      const turn = await roomsApi.getTurnCredentials().catch(() => ({ iceServers: [] as RTCIceServer[] }));
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }, ...(turn.iceServers ?? [])],
        bundlePolicy: "max-bundle",
      });
      peerRef.current = peer;

      const remoteStream = new MediaStream();

      peer.ontrack = (event) => {
        if (disposed) return;
        const track = event.track;
        if (track.kind === "video") {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
          setOpponentStream(remoteStream);
          return;
        }
        // Opponent audio -> dedicated hidden element (same reason as chat's
        // playRemoteAudioTrack: tracks added later to a shared stream aren't
        // reliably played back by the browser).
        if (!audioElsRef.current.has(track.id)) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          audio.setAttribute("playsinline", "true");
          audio.style.display = "none";
          audio.srcObject = new MediaStream([track]);
          document.body.appendChild(audio);
          audio.play().catch(() => {});
          audioElsRef.current.set(track.id, audio);
        }
      };

      peer.onconnectionstatechange = () => {
        if (disposed) return;
        setOpponentConnected(peer.connectionState === "connected");
      };

      peer.addTransceiver("video", { direction: "recvonly" });
      peer.addTransceiver("audio", { direction: "recvonly" });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("Opponent media offer SDP was not created.");

      const result = await roomsApi.createViewerSession(opponentRoomId, sdp);

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: "answer", sdp: result.answerSdp });
      } else if (result.offerSdp) {
        await peer.setRemoteDescription({ type: "offer", sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForFirstUsableCandidate(peer);
        if (peer.localDescription?.sdp) {
          await roomsApi.completeRenegotiation(opponentRoomId, peer.localDescription.sdp);
        }
      }

      await waitForPeerConnectionConnected(peer, 20_000, 400);

      if (disposed) return;
      sessionRef.current = {
        sessionId: result.session.sessionId,
        generation: result.session.generation,
      };
      setOpponentConnected(true);
    };

    connect().catch((error) => {
      console.error("[PK media] opponent connect failed:", error);
    });

    const hb = window.setInterval(() => {
      const s = sessionRef.current;
      if (s) {
        roomsApi
          .heartbeat(opponentRoomId, {
            role: "viewer",
            sessionId: s.sessionId,
            generation: s.generation,
          })
          .catch(() => {});
      }
    }, HEARTBEAT_MS);

    return () => {
      disposed = true;
      window.clearInterval(hb);

      const peer = peerRef.current;
      peerRef.current = null;
      if (peer) {
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        try {
          peer.close();
        } catch {
          // Already closed.
        }
      }

      for (const [, el] of audioElsRef.current) {
        try {
          el.pause();
          el.srcObject = null;
          el.remove();
        } catch {
          // Already detached.
        }
      }
      audioElsRef.current.clear();

      roomsApi.leaveViewer(opponentRoomId).catch(() => {});
      sessionRef.current = null;
      setOpponentStream(null);
      setOpponentConnected(false);
    };
  }, [opponentRoomId, userId]);

  return { opponentStream, opponentConnected, opponentRoomId };
}
