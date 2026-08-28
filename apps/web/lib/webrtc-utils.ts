// apps/web/lib/webrtc-utils.ts
//
// FIX (waitForPeerConnectionConnected): the old default was
// `stableMs = 300` for hosts and viewers called it with an explicit
// `400`. That means AFTER the browser already reports
// connectionState === "connected", the code still sat there doing
// nothing for another 300-400ms before resolving, on every single join.
// That's pure dead time added to every viewer's join, for every viewer,
// every time. Dropped to 120ms — enough to avoid acting on a one-tick
// flicker back to "connecting", not enough to be felt as lag.
//
// FIX (waitForFirstUsableCandidate): left the same 1200ms ceiling, but
// it already resolves as soon as the FIRST usable candidate shows up
// (not full ICE gathering), so this one was not the bottleneck — kept
// as-is for reference/completeness.

import { roomsApi, type RoomMediaState, type MediaTrackInput } from '@/lib/api/rooms';

/**
 * Wait for the first usable ICE candidate (host or srflx) to be gathered.
 * Resolves as soon as we have a candidate or when gathering completes.
 */
export function waitForFirstUsableCandidate(
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
      peer.removeEventListener("icegatheringstatechange", onStateChange);
      window.clearTimeout(timer);
      resolve();
    };

    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
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
    peer.addEventListener("icegatheringstatechange", onStateChange);

    const timer = window.setTimeout(finish, timeoutMs);
  });
}

/**
 * Wait for the RTCPeerConnection to be fully connected and stable.
 *
 * `stableMs` default dropped 300 -> 120. Every ms here is added latency
 * on top of the real network handshake, for every join.
 */
export function waitForPeerConnectionConnected(
  peer: RTCPeerConnection,
  timeoutMs = 20000,
  stableMs = 120,
): Promise<void> {
  const isReady = () =>
    peer.connectionState === "connected" &&
    (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed");

  if (isReady()) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, stableMs);
    });
  }

  return new Promise((resolve, reject) => {
    let stableTimer: number | null = null;
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          `Viewer PeerConnection did not become ready. connectionState=${peer.connectionState}, iceConnectionState=${peer.iceConnectionState}`,
        ),
      );
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      if (stableTimer !== null) window.clearTimeout(stableTimer);
      peer.removeEventListener("connectionstatechange", handleStateChange);
      peer.removeEventListener("iceconnectionstatechange", handleStateChange);
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    const handleStateChange = () => {
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed" ||
        peer.iceConnectionState === "failed" ||
        peer.iceConnectionState === "closed"
      ) {
        fail(
          `Viewer PeerConnection failed. connectionState=${peer.connectionState}, iceConnectionState=${peer.iceConnectionState}`,
        );
        return;
      }

      if (!isReady()) return;
      if (stableTimer !== null) return;

      stableTimer = window.setTimeout(() => {
        stableTimer = null;
        if (isReady()) {
          cleanup();
          resolve();
        }
      }, stableMs);
    };

    peer.addEventListener("connectionstatechange", handleStateChange);
    peer.addEventListener("iceconnectionstatechange", handleStateChange);
    handleStateChange();
  });
}

/**
 * Wait until the host media state is visible in the backend (Redis).
 *
 * FIX: pollMs dropped 500 -> 250 so that IF a viewer happens to join in
 * the split second before the host's "connected" status has propagated,
 * they pick it up twice as fast. Doesn't matter for the common case
 * (host already live -> resolves on the very first call), only helps the
 * edge case.
 */
export async function waitForHostMediaState(
  roomId: string,
  timeoutMs = 20000,
  pollMs = 250,
): Promise<RoomMediaState> {
  const startedAt = Date.now();
  let lastState: RoomMediaState | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await roomsApi.getMediaState(roomId);
    if (lastState.host && lastState.host.status === "connected") {
      return lastState;
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollMs));
  }

  if (lastState) {
    return lastState;
  }
  throw new Error("Host media state could not be loaded.");
}

/**
 * Create a unique track name for Cloudflare.
 */
export function createTrackName(kind: "audio" | "video", userId: string) {
  return `room-${kind}-${userId}-${crypto.randomUUID()}`;
}

/**
 * Build the MediaTrackInput array from transceivers.
 */
export function createPublishTracks(
  transceivers: Array<{
    transceiver: RTCRtpTransceiver;
    track: MediaStreamTrack;
    trackName: string;
  }>,
): MediaTrackInput[] {
  return transceivers.map(({ transceiver, track, trackName }) => {
    const mid = transceiver.mid;
    if (!mid) {
      throw new Error(`Browser did not assign an SDP MID for ${track.kind} track.`);
    }
    return {
      trackName,
      kind: track.kind === "video" ? "video" : "audio",
      direction: "publish",
      mid,
    };
  });
}

/**
 * Add recvonly transceivers for a viewer based on the current media state.
 */
export function createViewerTransceivers(
  peer: RTCPeerConnection,
  state: RoomMediaState,
) {
  if (!state.host) return;

  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });

  for (const speaker of Object.values(state.speakers)) {
    if (speaker.status !== "connected") continue;
    peer.addTransceiver("audio", { direction: "recvonly" });
    if (speaker.videoTrackName) {
      peer.addTransceiver("video", { direction: "recvonly" });
    }
  }
}