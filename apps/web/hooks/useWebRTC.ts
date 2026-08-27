import { useRef, useState, useEffect, useCallback } from 'react';
import { roomsApi, type RoomRecord, type RoomMediaState } from '@/lib/api/rooms';
import {
  waitForFirstUsableCandidate,
  waitForPeerConnectionConnected,
  waitForHostMediaState,
  createPublishTracks,
  createTrackName,
  createViewerTransceivers,
} from '@/lib/webrtc-utils';

export function useWebRTC(
  room: RoomRecord | null,
  userId: string | null,
  cameraEnabled: boolean = true,
  micEnabled: boolean = true,
) {
  const isHost = !!room && userId === room.host_id;

  // ---- State ----
  const [hostPublishing, setHostPublishing] = useState(false);
  const [hostMediaReady, setHostMediaReady] = useState(false);
  const [viewerConnected, setViewerConnected] = useState(false);
  const [speakerPublishing, setSpeakerPublishing] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mediaState, setMediaState] = useState<RoomMediaState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null); 

  // ---- Refs for peers and streams ----
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostPeerRef = useRef<RTCPeerConnection | null>(null);
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const guestPeerRef = useRef<RTCPeerConnection | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const hostSessionRef = useRef<{ sessionId: string; generation: number } | null>(null);
  const viewerSessionRef = useRef<{ sessionId: string; generation: number } | null>(null);
  const hostSpeakerIdsRef = useRef<Set<string>>(new Set());
  const viewerSpeakerIdsRef = useRef<Set<string>>(new Set());

  // ---- Locks to prevent overlapping negotiations ----
  const mediaSyncBusyRef = useRef(false);

  // ---- ICE servers (STUN + TURN) ----
  // STUN alone can't help clients behind a NAT/firewall that blocks
  // direct UDP paths (corporate networks, some carriers/VPNs) — those
  // clients need a TURN relay or ICE negotiation fails outright
  // ("connectionState=failed, iceConnectionState=disconnected"),
  // which showed up specifically for guests trying to publish audio.
  // Fetched once per mount and cached; falls back to STUN-only if the
  // request fails so publishing still works on networks where a
  // direct path is possible.
  const iceServersPromiseRef = useRef<Promise<RTCIceServer[]> | null>(null);
  const getIceServers = useCallback((): Promise<RTCIceServer[]> => {
    if (!iceServersPromiseRef.current) {
      iceServersPromiseRef.current = roomsApi
        .getTurnCredentials()
        .then((result) => [
          { urls: 'stun:stun.cloudflare.com:3478' },
          ...(result.iceServers ?? []),
        ])
        .catch((e) => {
          console.error(
            '[useWebRTC] Failed to fetch TURN credentials, falling back to STUN only:',
            e,
          );
          return [{ urls: 'stun:stun.cloudflare.com:3478' }];
        });
    }
    return iceServersPromiseRef.current;
  }, []);

  // Warm the TURN credential fetch as soon as this hook mounts, so it's
  // typically already resolved by the time any publish/subscribe flow
  // needs it below.
  useEffect(() => {
    getIceServers().catch(() => {});
  }, [getIceServers]);

  // ---- Helper: stop local media ----
const stopLocalMedia = useCallback(() => {
  localStreamRef.current?.getTracks().forEach((t) => t.stop());
  localStreamRef.current = null;
  setLocalStream(null);
}, []);

  // ---- Helper: close peer connections ----
  const closeHostPeer = useCallback(() => {
    hostPeerRef.current?.close();
    hostPeerRef.current = null;
    hostSessionRef.current = null;
  }, []);

  const closeViewerPeer = useCallback(() => {
    viewerPeerRef.current?.close();
    viewerPeerRef.current = null;
    viewerSessionRef.current = null;
    remoteStreamRef.current = null;
    viewerSpeakerIdsRef.current.clear();
  }, []);

  const closeGuestPeer = useCallback(() => {
    guestPeerRef.current?.close();
    guestPeerRef.current = null;
    guestStreamRef.current?.getTracks().forEach((t) => t.stop());
    guestStreamRef.current = null;
    setSpeakerPublishing(false);
  }, []);

  const closeHostSubscriptions = useCallback(() => {
    hostSpeakerIdsRef.current.clear();
  }, []);

  // ---- Ensure local preview ----
 const ensureLocalPreview = useCallback(async () => {
  if (localStreamRef.current) return localStreamRef.current;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode: 'user',
      width: { ideal: 1080 },
      height: { ideal: 1920 },
    },
  });

  localStreamRef.current = stream;
  setLocalStream(stream); // NEW — triggers a re-render the moment the camera turns on,
                           // instead of waiting for negotiation to finish
  return stream;
}, []);

  // ---- Host publish media ----
  const publishHostMedia = useCallback(
    async (currentRoom: RoomRecord) => {
      const stream = await ensureLocalPreview();

      const iceServers = await getIceServers();
      const peer = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'max-bundle',
      });
      hostPeerRef.current = peer;

      const transceivers: Array<{
        transceiver: RTCRtpTransceiver;
        track: MediaStreamTrack;
        trackName: string;
      }> = [];

      for (const track of stream.getTracks()) {
        const transceiver = peer.addTransceiver(track, { direction: 'sendonly' });
        transceivers.push({
          transceiver,
          track,
          trackName: createTrackName(track.kind === 'video' ? 'video' : 'audio', userId ?? 'host'),
        });
      }

      // Initial offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error('Browser did not generate a valid SDP offer.');

      const tracks = createPublishTracks(transceivers);
      const initialResult = await roomsApi.publishHost(currentRoom.id, {
        offerSdp: localDescription.sdp,
        tracks,
      });

      if (!initialResult.answerSdp) throw new Error('Cloudflare did not return initial SDP answer.');
      await peer.setRemoteDescription({ type: 'answer', sdp: initialResult.answerSdp });
      await waitForPeerConnectionConnected(peer);

      // Renegotiation for tracks
      const renegotiationOffer = await peer.createOffer();
      await peer.setLocalDescription(renegotiationOffer);
      await waitForFirstUsableCandidate(peer);

      const renegotiationDescription = peer.localDescription;
      if (!renegotiationDescription?.sdp) throw new Error('No valid track negotiation offer.');

      const result = await roomsApi.publishHost(currentRoom.id, {
        offerSdp: renegotiationDescription.sdp,
        tracks,
      });

      if (!result.answerSdp) throw new Error('Cloudflare did not return track negotiation answer.');
      await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });

      hostSessionRef.current = {
        sessionId: result.session.sessionId,
        generation: result.session.generation,
      };

      // Wait for host media state to propagate
      const state = await waitForHostMediaState(currentRoom.id, 5000, 250);
      if (!state.host || state.host.sessionId !== result.session.sessionId) {
        throw new Error('Host media state not registered.');
      }

      setHostMediaReady(true);
      setHostPublishing(true);

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
          setHostPublishing(false);
          setHostMediaReady(false);
        }
      };
    },
    [userId, ensureLocalPreview, getIceServers],
  );

  // ---- Viewer connect ----
  const connectViewer = useCallback(
    async (currentRoom: RoomRecord) => {
      const state = await waitForHostMediaState(currentRoom.id, 20000, 500);
      if (!state.host || state.host.status !== 'connected') {
        throw new Error('Host is still connecting. Try again.');
      }

      const peer = new RTCPeerConnection({
        iceServers: await getIceServers(),
        bundlePolicy: 'max-bundle',
      });
      viewerPeerRef.current = peer;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      peer.ontrack = (event) => {
        for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        }
      };

      peer.onconnectionstatechange = () => {
        const ready = peer.connectionState === 'connected';
        setViewerConnected(ready);
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
          setViewerConnected(false);
        }
      };

      createViewerTransceivers(peer, state);
      // Only mark speakers as "already subscribed" if they were actually
      // ready (status "connected") when this session was created — see
      // createViewerTransceivers. Anyone still mid-publish must remain
      // eligible for syncViewerSpeakerAudio's regular poll so they get
      // picked up once their track is really live, instead of being
      // silently and permanently skipped for this viewer.
      viewerSpeakerIdsRef.current = new Set(
        Object.entries(state.speakers)
          .filter(([, speaker]) => speaker.status === 'connected')
          .map(([id]) => id),
      );

      // Phase 1: create session
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error('No valid viewer SDP.');

      const initialResult = await roomsApi.createViewerSession(currentRoom.id, localDescription.sdp);
      if (!initialResult.answerSdp) throw new Error('No initial viewer SDP answer.');
      await peer.setRemoteDescription({ type: 'answer', sdp: initialResult.answerSdp });
      await waitForPeerConnectionConnected(peer, 20000, 500);

      viewerSessionRef.current = {
        sessionId: initialResult.session.sessionId,
        generation: initialResult.session.generation,
      };

      // Phase 2: add tracks
      const renegotiationOffer = await peer.createOffer();
      await peer.setLocalDescription(renegotiationOffer);
      await waitForFirstUsableCandidate(peer);

      const renegotiationDescription = peer.localDescription;
      if (!renegotiationDescription?.sdp) throw new Error('No valid track negotiation offer.');

      const result = await roomsApi.createViewerSession(currentRoom.id, renegotiationDescription.sdp);

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
      } else if (result.offerSdp) {
        await peer.setRemoteDescription({ type: 'offer', sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForFirstUsableCandidate(peer);
        const localAnswer = peer.localDescription;
        if (!localAnswer?.sdp) throw new Error('No viewer renegotiation answer.');
        await roomsApi.completeRenegotiation(currentRoom.id, localAnswer.sdp);
      } else {
        throw new Error('No SDP returned for track negotiation.');
      }

      await waitForPeerConnectionConnected(peer, 20000, 500);
      setViewerConnected(true);
    },
    [getIceServers],
  );

  // ---- Guest publish audio ----
  const publishGuestAudio = useCallback(async () => {
    if (!room || isHost || speakerPublishing) return;

    setMediaError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      guestStreamRef.current = stream;

      const peer = new RTCPeerConnection({
        iceServers: await getIceServers(),
        bundlePolicy: 'max-bundle',
      });
      guestPeerRef.current = peer;

      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('Microphone track not created.');
      const transceiver = peer.addTransceiver(track, { direction: 'sendonly' });

      // Initial offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const firstDescription = peer.localDescription;
      if (!firstDescription?.sdp) throw new Error('Microphone SDP offer not created.');

      const tracks = createPublishTracks([
        { transceiver, track, trackName: createTrackName('audio', userId ?? 'speaker') },
      ]);

      const initial = await roomsApi.publishGuest(room.id, {
        offerSdp: firstDescription.sdp,
        tracks,
      });

      if (!initial.answerSdp) throw new Error('Guest media session did not return SDP answer.');
      await peer.setRemoteDescription({ type: 'answer', sdp: initial.answerSdp });
      await waitForPeerConnectionConnected(peer, 20000, 400);

      // Renegotiation
      const renegotiationOffer = await peer.createOffer();
      await peer.setLocalDescription(renegotiationOffer);
      await waitForFirstUsableCandidate(peer);

      const renegotiationDescription = peer.localDescription;
      if (!renegotiationDescription?.sdp) throw new Error('Guest audio negotiation offer not created.');

      const result = await roomsApi.publishGuest(room.id, {
        offerSdp: renegotiationDescription.sdp,
        tracks,
      });

      if (!result.answerSdp) throw new Error('Guest audio negotiation failed.');
      await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
          setSpeakerPublishing(false);
        }
      };

      setSpeakerPublishing(true);
    } catch (error) {
      /*
       * The FIRST publishGuest call above already wrote a "connecting"
       * speaker session to Redis, even if everything after it (e.g.
       * ICE never reaching "connected") fails. Without cleaning that up,
       * the next retry's server call sees an "existing speaker" and
       * tries to renegotiate against that abandoned Cloudflare session
       * instead of starting a fresh one — which can never succeed. That
       * leaves the speaker permanently stuck in "connecting", and the
       * host's subscription poll spins forever on
       * "409 No guest audio is active". Clear the stale reservation so
       * the next attempt gets a clean slate.
       */
      await roomsApi.unpublishGuest(room.id).catch(() => {});
      closeGuestPeer();
      throw error;
    }
  }, [room, isHost, userId, speakerPublishing, getIceServers, closeGuestPeer]);

  // ---- Sync host guest audio ----
  const syncHostGuestAudio = useCallback(
    async (state: RoomMediaState) => {
      if (!room || !isHost || !hostPeerRef.current || !hostMediaReady) return;

      const speakerIds = Object.keys(state.speakers).filter(
        (speakerId) => !hostSpeakerIdsRef.current.has(speakerId),
      );
      if (speakerIds.length === 0) return;

      const peer = hostPeerRef.current;
      const attemptedIds: string[] = [];
      const addedTransceivers: RTCRtpTransceiver[] = [];

      try {
        for (const speakerId of speakerIds) {
          const transceiver = peer.addTransceiver('audio', { direction: 'recvonly' });
          addedTransceivers.push(transceiver);
          attemptedIds.push(speakerId);
        }

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForFirstUsableCandidate(peer);

        const localDescription = peer.localDescription;
        if (!localDescription?.sdp) throw new Error('Host guest-audio SDP not created.');

        const result = await roomsApi.subscribeHostToGuests(room.id, {
          offerSdp: localDescription.sdp,
          speakerIds: attemptedIds,
        });

        if (result.alreadySubscribed) {
          for (const speakerId of attemptedIds) hostSpeakerIdsRef.current.add(speakerId);
          if (peer.signalingState !== 'stable') {
            await peer.setLocalDescription({ type: 'rollback' });
          }
          for (const transceiver of addedTransceivers) {
            try {
              transceiver.stop();
            } catch {}
          }
          return;
        }

        if (!result.answerSdp && !result.offerSdp) {
          for (const speakerId of attemptedIds) hostSpeakerIdsRef.current.add(speakerId);
          if (peer.signalingState !== 'stable') {
            await peer.setLocalDescription({ type: 'rollback' });
          }
          for (const transceiver of addedTransceivers) {
            try {
              transceiver.stop();
            } catch {}
          }
          return;
        }

        if (result.answerSdp) {
          await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
        } else if (result.offerSdp) {
          await peer.setRemoteDescription({ type: 'offer', sdp: result.offerSdp });
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await waitForFirstUsableCandidate(peer);
          const localAnswer = peer.localDescription;
          if (!localAnswer?.sdp) throw new Error('Host guest-audio answer not created.');
          await roomsApi.subscribeHostToGuests(room.id, {
            answerSdp: localAnswer.sdp,
            speakerIds: attemptedIds,
          });
        } else {
          throw new Error('Host guest-audio negotiation returned no SDP.');
        }

        for (const speakerId of attemptedIds) {
          hostSpeakerIdsRef.current.add(speakerId);
        }
      } catch (error) {
        for (const speakerId of attemptedIds) {
          hostSpeakerIdsRef.current.delete(speakerId);
        }
        for (const transceiver of addedTransceivers) {
          try {
            transceiver.stop();
          } catch {}
        }
        if (peer.signalingState !== 'stable') {
          try {
            await peer.setLocalDescription({ type: 'rollback' });
          } catch {}
        }
        throw error;
      }
    },
    [room, isHost, hostMediaReady],
  );

  // ---- Sync viewer speaker audio ----
 const syncViewerSpeakerAudio = useCallback(
  async (state: RoomMediaState) => {
    if (!room || isHost || !viewerPeerRef.current || !viewerSessionRef.current) return;

    const newSpeakers = Object.keys(state.speakers).filter(
      (speakerId) => !viewerSpeakerIdsRef.current.has(speakerId),
    );
    if (newSpeakers.length === 0) return;

    const peer = viewerPeerRef.current;
    const addedTransceivers: RTCRtpTransceiver[] = [];

    try {
      for (const speakerId of newSpeakers) {
        addedTransceivers.push(peer.addTransceiver('audio', { direction: 'recvonly' }));
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error('Viewer speaker-audio offer not created.');

      // Use the dedicated "add tracks to my existing viewer session" endpoint —
      // NOT createViewerSession, which only resumes a session while it's still
      // "connecting" and otherwise silently spins up a brand-new Cloudflare
      // session that this RTCPeerConnection has no relationship to.
      const result = await roomsApi.subscribeViewerToSpeakers(room.id, {
        offerSdp: localDescription.sdp,
        speakerIds: newSpeakers,
      });

      if (result.alreadySubscribed || (!result.answerSdp && !result.offerSdp)) {
        for (const speakerId of newSpeakers) viewerSpeakerIdsRef.current.add(speakerId);
        if (peer.signalingState !== 'stable') {
          await peer.setLocalDescription({ type: 'rollback' });
        }
        for (const transceiver of addedTransceivers) {
          try { transceiver.stop(); } catch {}
        }
        return;
      }

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
      } else if (result.offerSdp) {
        await peer.setRemoteDescription({ type: 'offer', sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForFirstUsableCandidate(peer);
        const localAnswer = peer.localDescription;
        if (!localAnswer?.sdp) throw new Error('Viewer speaker-audio answer not created.');
        await roomsApi.subscribeViewerToSpeakers(room.id, {
          answerSdp: localAnswer.sdp,
          speakerIds: newSpeakers,
        });
      }

      for (const speakerId of newSpeakers) {
        viewerSpeakerIdsRef.current.add(speakerId);
      }
    } catch (error) {
      for (const transceiver of addedTransceivers) {
        try { transceiver.stop(); } catch {}
      }
      if (peer.signalingState !== 'stable') {
        try { await peer.setLocalDescription({ type: 'rollback' }); } catch {}
      }
      throw error;
    }
  },
  [room, isHost],
);
  // ---- Host camera/mic preview while waiting to go live ----
  // Without this, getUserMedia() is only ever called from inside
  // publishHostMedia() (i.e. after clicking "Start Live"), so the camera
  // light never turns on and there's nothing to preview beforehand.
  useEffect(() => {
    if (!isHost || room?.status !== 'created') return;

    ensureLocalPreview().catch((e) => {
      setMediaError(e instanceof Error ? e.message : 'Camera or microphone permission was denied.');
    });
  }, [isHost, room?.status, ensureLocalPreview]);

  // ---- Reflect camera/mic toggle state onto the live local tracks ----
  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  // ---- Heartbeats ----
  useEffect(() => {
    if (!hostSessionRef.current || !isHost) return;
    const timer = setInterval(() => {
      const s = hostSessionRef.current;
      if (!s) return;
      roomsApi
        .heartbeat(room!.id, {
          role: 'host',
          sessionId: s.sessionId,
          generation: s.generation,
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [isHost, room?.id]);

  useEffect(() => {
    if (!viewerSessionRef.current || isHost) return;
    const timer = setInterval(() => {
      const s = viewerSessionRef.current;
      if (!s) return;
      roomsApi
        .heartbeat(room!.id, {
          role: 'viewer',
          sessionId: s.sessionId,
          generation: s.generation,
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [isHost, room?.id]);

  useEffect(() => {
    if (!speakerPublishing || isHost) return;
    const timer = setInterval(() => {
      const session = mediaState?.speakers[userId ?? ''];
      if (!session) return;
      roomsApi
        .heartbeat(room!.id, {
          role: 'speaker',
          sessionId: session.sessionId,
          generation: mediaState.generation,
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [speakerPublishing, isHost, mediaState, userId, room?.id]);

  // ---- Media state polling ----
  useEffect(() => {
    if (!room || room.status !== 'live') return;
    let active = true;
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const state = await roomsApi.getMediaState(room.id);
        if (!active) return;
        setMediaState(state);

        // Host sync
        if (isHost && !mediaSyncBusyRef.current) {
          mediaSyncBusyRef.current = true;
          try {
            await syncHostGuestAudio(state);
          } catch (e) {
            console.error('Host guest audio sync failed', e);
          } finally {
            mediaSyncBusyRef.current = false;
          }
        }

        // Guest auto-publish if accepted
        if (!isHost && state.speakers[userId ?? '']) {
          if (!speakerPublishing && !mediaSyncBusyRef.current) {
            mediaSyncBusyRef.current = true;
            try {
              await publishGuestAudio();
            } catch (e) {
              setMediaError(e instanceof Error ? e.message : 'Microphone could not be connected.');
              closeGuestPeer();
            } finally {
              mediaSyncBusyRef.current = false;
            }
          }
        }

        // Viewer speaker sync
        if (!isHost && viewerConnected && !mediaSyncBusyRef.current) {
          mediaSyncBusyRef.current = true;
          try {
            await syncViewerSpeakerAudio(state);
          } catch (e) {
            console.error('Viewer speaker sync failed', e);
          } finally {
            mediaSyncBusyRef.current = false;
          }
        }

        // Host media ready check
        if (isHost && state.host?.userId === userId) {
          setHostMediaReady(true);
          setHostPublishing(true);
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    interval = setInterval(poll, 1800);
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [
    room?.id,
    room?.status,
    isHost,
    userId,
    syncHostGuestAudio,
    syncViewerSpeakerAudio,
    publishGuestAudio,
    viewerConnected,
    speakerPublishing,
    closeGuestPeer,
  ]);

  // ---- Leave / cleanup ----
  const leave = useCallback(async () => {
    try {
      if (viewerSessionRef.current) {
        await roomsApi.leaveViewer(room!.id).catch(() => {});
      }
      if (speakerPublishing) {
        await roomsApi.unpublishGuest(room!.id).catch(() => {});
      }
      if (isHost && room?.status === 'live') {
        await roomsApi.end(room.id).catch(() => {});
      }
    } finally {
      closeViewerPeer();
      closeGuestPeer();
      closeHostPeer();
      closeHostSubscriptions();
      stopLocalMedia();
      setHostPublishing(false);
      setHostMediaReady(false);
      setViewerConnected(false);
    }
  }, [
    room,
    isHost,
    speakerPublishing,
    closeViewerPeer,
    closeGuestPeer,
    closeHostPeer,
    closeHostSubscriptions,
    stopLocalMedia,
  ]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      closeViewerPeer();
      closeGuestPeer();
      closeHostPeer();
      closeHostSubscriptions();
      stopLocalMedia();
    };
  }, [closeViewerPeer, closeGuestPeer, closeHostPeer, closeHostSubscriptions, stopLocalMedia]);

  // ---- Expose methods and state ----
  const startHost = useCallback(
    async (currentRoom: RoomRecord) => {
      setMediaError('');
      setHostMediaReady(false);
      setHostPublishing(false);

      let roomStartedByThisCall = false;

      try {
        // The host preview may already have acquired the camera/mic while
        // the room is still in the `created` state. Reuse that stream.
        await ensureLocalPreview();

        // IMPORTANT: publishing media is not what makes the room live.
        // The database room lifecycle must be advanced first so the media
        // endpoints (and speaker-request polling) are allowed to proceed.
        const liveRoom =
          currentRoom.status === 'created'
            ? await roomsApi.start(currentRoom.id)
            : currentRoom;

        roomStartedByThisCall = currentRoom.status === 'created';

        await publishHostMedia(liveRoom);
      } catch (e) {
        // If we successfully transitioned the room to live but media setup
        // failed, don't leave a ghost live room behind.
        if (roomStartedByThisCall) {
          await roomsApi.end(currentRoom.id).catch(() => {});
        }

        closeHostPeer();
        stopLocalMedia();
        setHostMediaReady(false);
        setHostPublishing(false);
        setMediaError(e instanceof Error ? e.message : 'Start failed');
        throw e;
      }
    },
    [
      ensureLocalPreview,
      publishHostMedia,
      closeHostPeer,
      stopLocalMedia,
    ],
  );

  const joinViewer = useCallback(
    async (currentRoom: RoomRecord) => {
      setMediaError('');
      try {
        await connectViewer(currentRoom);
      } catch (e) {
        setMediaError(e instanceof Error ? e.message : 'Join failed');
        throw e;
      }
    },
    [connectViewer],
  );

  return {
    // state
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
    publishGuestAudio
  };
}