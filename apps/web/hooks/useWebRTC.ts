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

  // ---- Helper: stop local media ----
  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
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
    return stream;
  }, []);

  // ---- Host publish media ----
  const publishHostMedia = useCallback(
    async (currentRoom: RoomRecord) => {
      const stream = await ensureLocalPreview();

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
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
    [userId, ensureLocalPreview],
  );

  // ---- Viewer connect ----
  const connectViewer = useCallback(
    async (currentRoom: RoomRecord) => {
      const state = await waitForHostMediaState(currentRoom.id, 20000, 500);
      if (!state.host || state.host.status !== 'connected') {
        throw new Error('Host is still connecting. Try again.');
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
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
      viewerSpeakerIdsRef.current = new Set(Object.keys(state.speakers));

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
    [],
  );

  // ---- Guest publish audio ----
  const publishGuestAudio = useCallback(async () => {
    if (!room || isHost || speakerPublishing) return;

    setMediaError('');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    guestStreamRef.current = stream;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
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
  }, [room, isHost, userId, speakerPublishing]);

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
      for (const speakerId of newSpeakers) {
        peer.addTransceiver('audio', { direction: 'recvonly' });
        viewerSpeakerIdsRef.current.add(speakerId);
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForFirstUsableCandidate(peer);

      const localDescription = peer.localDescription;
      if (!localDescription?.sdp) throw new Error('Viewer speaker-audio offer not created.');

      const result = await roomsApi.createViewerSession(room.id, localDescription.sdp);

      if (result.answerSdp) {
        await peer.setRemoteDescription({ type: 'answer', sdp: result.answerSdp });
        return;
      }

      if (result.offerSdp) {
        await peer.setRemoteDescription({ type: 'offer', sdp: result.offerSdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await waitForFirstUsableCandidate(peer);
        const localAnswer = peer.localDescription;
        if (!localAnswer?.sdp) throw new Error('Viewer speaker-audio answer not created.');
        await roomsApi.completeRenegotiation(room.id, localAnswer.sdp);
        return;
      }

      throw new Error('Viewer speaker-audio negotiation returned no SDP.');
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
      try {
        await publishHostMedia(currentRoom);
      } catch (e) {
        setMediaError(e instanceof Error ? e.message : 'Start failed');
        throw e;
      }
    },
    [publishHostMedia],
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
    // refs
    localStreamRef,
    remoteStreamRef,
    // actions
    startHost,
    joinViewer,
    leave,
  };
}