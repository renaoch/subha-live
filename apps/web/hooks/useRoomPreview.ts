// apps/web/hooks/useRoomPreview.ts
//
// A deliberately tiny sibling to useWebRTC's `connectViewer`, for one
// narrow job: silently subscribe to a room's host video/audio for the
// home-feed "live preview" cards, and tear the session down the instant
// the card scrolls out of view.
//
// This does NOT reuse useWebRTC — that hook carries a lot of state meant
// for a single active room session (renegotiation queues, speaker
// tracking, chat, polling loops). Mounting several of those at once for
// every visible feed card would be wasteful and easy to get wrong. This
// hook only ever does: connect, receive, disconnect.
//
// The session it opens is marked `preview: true` (see media.types.ts /
// room-media.service.ts) so it does NOT count toward the room's
// `viewerCount` — scrolling past a room in the feed shouldn't inflate the
// host's audience number.

import { useEffect, useRef, useState } from "react";
import { roomsApi } from "@/lib/api/rooms";
import { waitForFirstUsableCandidate } from "@/lib/webrtc-utils";

let iceServersPromise: Promise<RTCIceServer[]> | null = null;

function getIceServers(): Promise<RTCIceServer[]> {
  const cached = iceServersPromise;
  if (cached) return cached;

  const created: Promise<RTCIceServer[]> = roomsApi
    .getTurnCredentials()
    .then((result: { iceServers?: RTCIceServer[] }) => [
      { urls: "stun:stun.cloudflare.com:3478" },
      ...(result.iceServers ?? []),
    ])
    .catch(() => [{ urls: "stun:stun.cloudflare.com:3478" }]);

  iceServersPromise = created;
  return created;
}

/**
 * Silently subscribes to `roomId`'s live host feed while `active` is true,
 * and cleans up as soon as it goes false (card scrolled out of view) or
 * the component unmounts. Pass `active: false` (or `roomId: null`) to stay
 * fully idle — nothing is connected until both are truthy.
 */
export function useRoomPreview(roomId: string | null, active: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!roomId || !active) {
      return;
    }

    let cancelled = false;
    const generation = ++generationRef.current;

    // Small settle delay: fast scrolling would otherwise fire off a full
    // connect-then-immediately-disconnect for every card flashed past.
    // Only actually connect once a card has been in view for a moment.
    const settleTimer = window.setTimeout(async () => {
      if (cancelled || generation !== generationRef.current) return;

      try {
        const peer = new RTCPeerConnection({
          iceServers: await getIceServers(),
          bundlePolicy: "max-bundle",
        });

        if (cancelled || generation !== generationRef.current) {
          peer.close();
          return;
        }

        peerRef.current = peer;

        const remoteStream = new MediaStream();

        peer.ontrack = (event) => {
          if (peer !== peerRef.current) return;

          if (
            !remoteStream
              .getTracks()
              .some((existing) => existing.id === event.track.id)
          ) {
            remoteStream.addTrack(event.track);
          }

          if (mountedAndCurrent()) {
            setStream(remoteStream);
          }
        };

        peer.onconnectionstatechange = () => {
          if (peer !== peerRef.current) return;
          if (mountedAndCurrent()) {
            setConnected(peer.connectionState === "connected");
          }
        };

        function mountedAndCurrent() {
          return !cancelled && generation === generationRef.current;
        }

        peer.addTransceiver("video", { direction: "recvonly" });
        peer.addTransceiver("audio", { direction: "recvonly" });

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForFirstUsableCandidate(peer);

        const offerSdp = peer.localDescription?.sdp;
        if (!offerSdp || cancelled || generation !== generationRef.current) {
          peer.close();
          return;
        }

        // `preview: true` — see the comment at the top of this file.
        const result = await roomsApi.createViewerSession(
          roomId,
          offerSdp,
          true,
        );

        if (cancelled || generation !== generationRef.current) {
          peer.close();
          return;
        }

        if (result.answerSdp) {
          await peer.setRemoteDescription({
            type: "answer",
            sdp: result.answerSdp,
          });
        }
      } catch {
        // Previews are best-effort — a card that fails to preview just
        // falls back to its static cover image.
      }
    }, 350);

    return () => {
      cancelled = true;
      generationRef.current += 1;
      window.clearTimeout(settleTimer);

      const peer = peerRef.current;
      peerRef.current = null;

      if (peer) {
        try {
          peer.close();
        } catch {
          // Already closed.
        }
      }

      setStream(null);
      setConnected(false);

      roomsApi.leaveViewer(roomId).catch(() => {
        // Best-effort — a stale preview session will self-expire.
      });
    };
  }, [roomId, active]);

  return { stream, connected };
}
