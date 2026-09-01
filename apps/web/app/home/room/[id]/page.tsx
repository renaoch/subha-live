'use client';



import { use, useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { Loader2, Mic, MicOff } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

import { roomsApi } from '@/lib/api/rooms';

import { useRoom } from '@/hooks/useRoom';

import { useWebRTC } from '@/hooks/useWebRTC';

import { useSpeakerRequests } from '@/hooks/useSpeakerRequests';

import { useHostTask } from '@/hooks/useHostTask';

import { useRoomHeartbeat } from '@/hooks/useRoomHeartbeat';

import { useViewerRequestStatus } from '@/hooks/useViewerRequestStatus';

import { RoomHeader } from '@/components/RoomHeader';

import { LiveVideo } from '@/components/LiveVideo';

import { RoomMoreActions } from '@/components/RoomMoreActions';

import { HostControls } from '@/components/HostControls';

import { RoomChat } from '@/components/RoomChat';

import { RoomJoinFeed, type RoomJoinEvent } from '@/components/RoomJoinFeed';

import { useRoomChat } from '@/hooks/useRoomChat';

import { usePk } from '@/hooks/usePk';

import { usePkMedia } from '@/hooks/usePkMedia';

import { PkBattleBar } from '@/components/PkBattleBar';

import { PkBattleSheet } from '@/components/PkBattleSheet';

import { PkDualVideo } from '@/components/PkDualVideo';


import { GiftPickerSheet } from '@/components/GiftPickerSheet';

import { AudioStageModal } from '@/components/AudioStageModal';

import { SpeakerDock, type DockSpeaker } from '@/components/SpeakerDock';



const filterPresets = {

  Natural: 'none',

  Glow: 'brightness(1.08) saturate(1.08) contrast(0.96)',

  Warm: 'sepia(0.16) saturate(1.18) brightness(1.04)',

  Cool: 'hue-rotate(10deg) saturate(0.88) brightness(1.04)',

  Noir: 'grayscale(1) contrast(1.18) brightness(0.94)',

  Vintage: 'sepia(0.28) saturate(0.82) contrast(0.94) brightness(1.04)',

};



export default function RoomStagePage({ params }: { params: Promise<{ id: string }> }) {

  const { id } = use(params);

  const router = useRouter();



  // ---- User ----

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));

  }, []);



  // ---- Room ----

  const { room, isLoading, refetch } = useRoom(id);

  const isHost = !!room && userId === room.host_id;

  const isLive = room?.status === 'live';

  const isWaiting = room?.status === 'created';



  // ---- WebRTC ----

  const {

    hostPublishing,

    hostMediaReady,

    viewerConnected,

    speakerPublishing,

    mediaError,

    mediaState,

    speakingSpeakerIds,

    localStreamRef,

    remoteStreamRef,

    startHost,

    joinViewer,

    leave,

    publishGuestAudio

  } = useWebRTC(room, userId);



  // ---- Speaker Requests (host) ----

  const {

    requests,

    pending: hostRequestPending,

    requestAudio,

    approve,

    reject,

} = useSpeakerRequests(room?.id ?? '', isHost, room?.status);

  const { task, stats, claim, claiming } = useHostTask(
    room?.id ?? '',
    room?.status,
    isHost,
  );

  // Accrue streaming/watch hours toward the active host task.
  useRoomHeartbeat(room?.id ?? '', room?.status);

  // Live room chat over the realtime service.
  const { messages: chatMessages, state: chatState, selfUserId, canChat, send: sendChat } =
    useRoomChat(room?.id ?? '', room?.status);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);

  // PK battle (1v1) state + actions.
  const pk = usePk(room?.id ?? '', userId, isHost, room?.status);
  const [pkOpen, setPkOpen] = useState(false);

  // Opponent's stream for the dual-video PK view (client-side side-by-side).
  const { opponentStream, opponentConnected } = usePkMedia(room, userId, pk.state);

  // "Someone joined" pulses for RoomJoinFeed. The realtime service doesn't
  // currently emit a per-user join event with a username (only the polled
  // aggregate viewerCount on the room record), so each detected increase in
  // viewerCount fires one generic pulse. Swap this for a real presence/WS
  // event (with username + avatar) as soon as the backend exposes one —
  // RoomJoinFeed already accepts that richer shape via RoomJoinEvent.
  const [joinEvents, setJoinEvents] = useState<RoomJoinEvent[]>([]);
  const lastViewerCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = room?.viewerCount;
    if (typeof count !== 'number') return;
    const prev = lastViewerCountRef.current;
    lastViewerCountRef.current = count;
    if (prev === null || count <= prev) return;
    const gained = Math.min(count - prev, 3); // cap so a big jump doesn't spam the feed
    setJoinEvents((existing) => [
      ...existing,
      ...Array.from({ length: gained }).map((_, i) => ({
        id: `join-${Date.now()}-${i}`,
        username: 'New viewer',
        subtitle: 'joined the room',
      })),
    ].slice(-20));
  }, [room?.viewerCount]);



  // ---- Viewer's own request status ----

const { isPending: viewerRequestPending, isAccepted: viewerRequestAccepted } =
  useViewerRequestStatus(room?.id ?? '', isHost, userId);



  // ---- UI state ----

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  const [micEnabled, setMicEnabled] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState('Natural');

  const [speakerPanelOpen, setSpeakerPanelOpen] = useState(false);

  const [guestMicEnabled, setGuestMicEnabled] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  // Cache of userId -> {name, avatar} picked up from speaker requests, so
  // approved speakers still show a real name/avatar (instead of "Guest N")
  // once they leave the pending-requests list.
  const [speakerProfiles, setSpeakerProfiles] = useState<
    Record<string, { name: string; avatar: string | null }>
  >({});

  useEffect(() => {
    if (requests.length === 0) return;
    setSpeakerProfiles((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of requests) {
        if (r.user && !next[r.user_id]) {
          next[r.user_id] = { name: r.user.name, avatar: r.user.avatar };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [requests]);



  // ---- Handlers ----
const handleStart = useCallback(async () => {
  if (!room) return;
  setActionLoading(true);
  try {
    // Flip the room to "live" on the server FIRST. Every downstream
    // call (publishHost, speaker-requests polling, viewer join) is
    // gated on room.status === "live" and will 409 until this succeeds.
    const startedRoom = await roomsApi.start(room.id);
    await refetch();

    // Now that the room is live, actually publish the host's media.
    await startHost(startedRoom ?? room);

    toast.success("You're live");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Start failed');
  } finally {
    setActionLoading(false);
  }
}, [room, startHost, refetch]);

const handleJoin = useCallback(async () => {
  if (!room) return;
  setActionLoading(true);
  try {
    // Register the viewer as an active room_participants row FIRST —
    // requestAudio/createSpeakerRequest requires this row to exist,
    // and it was never being created anywhere before.
    await roomsApi.join(room.id);
    await joinViewer(room);
    toast.success('Connected to the live');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Join failed');
  } finally {
    setActionLoading(false);
  }
}, [room, joinViewer]);

  const handleLeave = useCallback(async () => {

    await leave();

    router.push('/home');

  }, [leave, router]);



  const handleEnd = useCallback(async () => {

    if (!room) return;

    setActionLoading(true);

    try {

      await roomsApi.end(room.id);

      toast.success('Live ended');

      refetch();

    } catch (e) {

      toast.error(e instanceof Error ? e.message : 'End failed');

    } finally {

      setActionLoading(false);

    }

  }, [room, refetch]);



  // ---- Auto-join for viewers ----

  useEffect(() => {

    if (!room || isHost || room.status !== 'live') return;

    handleJoin();

  }, [room?.id, room?.status, isHost, handleJoin]);

useEffect(() => {
  if (isHost || !viewerRequestAccepted || speakerPublishing) return;
  console.log('[GUEST-DEBUG] page.tsx effect triggering publishGuestAudio (viewerRequestAccepted=true)');
  publishGuestAudio().catch((e) => {
    console.error('[handleGuestAutoPublish] failed:', e);
  });
}, [isHost, viewerRequestAccepted, speakerPublishing, publishGuestAudio]);

  // ---- Auto-leave when room ends ----

  useEffect(() => {

    if (!room || isHost) return;

    if (room.status === 'ended') {

      toast.info('The host ended this live');

      handleLeave();

    }

  }, [room?.status, isHost, handleLeave]);



  // ---- Derived ----

  const activeSpeakers = useMemo(() => {

    return mediaState ? Object.values(mediaState.speakers) : [];

  }, [mediaState]);

  const seatCount = room?.max_guest_slots ?? 3;

  const occupiedSeats = Math.min(activeSpeakers.length, seatCount);

  const dockSpeakers: DockSpeaker[] = useMemo(
    () =>
      activeSpeakers.map((speaker, index) => {
        const profile = speakerProfiles[speaker.userId];
        return {
          userId: speaker.userId,
          name: profile?.name || `Guest ${index + 1}`,
          avatar: profile?.avatar ?? undefined,
          speaking: speakingSpeakerIds?.has(speaker.userId) ?? false,
        };
      }),
    [activeSpeakers, speakerProfiles, speakingSpeakerIds],
  );

  // Only the host sees pending requests, so only the host gets the
  // notification dot on the audio-stage button.
  const pendingRequestCount = isHost ? requests.length : 0;



  // ---- Loading ----

  if (isLoading) {

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

          <p className="text-lg font-bold">Room not found</p>

          <button

            onClick={() => router.push('/home')}

            className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"

          >

            Back home

          </button>

        </div>

      </main>

    );

  }



  // ---- Render ----

  return (

    <main className="min-h-[100svh] w-full overflow-hidden bg-black text-white">

      <section className="relative mx-auto h-[100svh] w-full max-w-[430px] overflow-hidden bg-black shadow-2xl">

        {/* Video layer */}

        {pk.state &&
        (pk.state.status === 'ACTIVE' ||
          pk.state.status === 'FINALIZING' ||
          pk.state.status === 'FINISHED') ? (
          <PkDualVideo
            isHost={isHost}
            localStream={localStreamRef.current}
            remoteStream={remoteStreamRef.current}
            opponentStream={opponentStream}
            opponentConnected={opponentConnected}
            filter={filterPresets[selectedFilter as keyof typeof filterPresets]}
            primaryLabel={isHost ? 'You' : room.host?.name || 'Host'}
            opponentLabel="Opponent"
          />
        ) : (
          <LiveVideo

            isHost={isHost}

            isWaiting={isWaiting}

            isLive={isLive}

            localStream={localStreamRef.current}

            remoteStream={remoteStreamRef.current}

            filter={filterPresets[selectedFilter as keyof typeof filterPresets]}

          />
        )}



        {/* Overlay gradients */}

        <div className="pointer-events-none absolute inset-0 bg-black/35" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/80 via-black/35 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/95 via-black/50 to-transparent" />



        {/* Error message */}

        {mediaError && isHost && isWaiting && (

          <div className="absolute left-5 right-5 top-5 z-50 rounded-2xl border border-red-300/20 bg-black/70 px-4 py-3 text-xs text-red-100 backdrop-blur-xl">

            {mediaError}

          </div>

        )}



        {/* Header */}

        <RoomHeader

          host={room.host}

          viewerCount={room.viewerCount ?? mediaState?.viewerCount ?? 1200}

          isLive={isLive}

          onLeave={handleLeave}

          currentUserId={userId}

          task={task}

          isHost={isHost}

          onClaimTask={isHost ? undefined : claim}

          claimingTask={claiming}

          taskStats={stats}

        />



        {/* Live indicator for host */}

        {isHost && isLive && (

          <div className="absolute left-1/2 top-[46px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-semibold tracking-wide backdrop-blur-xl">

            <span

              className={`mr-2 inline-block h-2 w-2 rounded-full ${

                hostMediaReady ? 'animate-pulse bg-red-400' : 'animate-pulse bg-amber-300'

              }`}

            />

            {hostMediaReady ? 'LIVE' : 'CONNECTING'}

          </div>

        )}



        {/* Audio stage button */}

        <button

          type="button"

          onClick={() => setSpeakerPanelOpen(true)}

          aria-label={`Open audio stage. ${occupiedSeats} of ${seatCount} occupied${
            pendingRequestCount > 0 ? `, ${pendingRequestCount} pending requests` : ''
          }`}

          className="absolute right-[13px] top-1/2 z-40 flex h-[29px] w-[29px] -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-xl transition hover:bg-black/60 active:scale-95"

        >

          <Mic className="h-[13px] w-[13px]" strokeWidth={1.6} />

          {occupiedSeats > 0 && (

            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">

              {occupiedSeats}

            </span>

          )}

          {pendingRequestCount > 0 && (

            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#FF3B5C] ring-2 ring-black">

              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3B5C] opacity-75" />

            </span>

          )}

        </button>



        {/* Always-visible speaker dock: shows connected speakers no matter

            whether the audio-stage sheet is open or closed. */}

        <SpeakerDock speakers={dockSpeakers} topOffset={100} />



        {/* Secondary actions live in a "more" sheet, opened from the chat bar,
            so the bottom edge stays to one clean row (chat + gift). */}
        <RoomMoreActions
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          isHost={isHost}
          cameraEnabled={cameraEnabled}
          onToggleCamera={() => setCameraEnabled((v) => !v)}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          micEnabled={micEnabled}
          onToggleMic={isHost ? () => setMicEnabled((v) => !v) : undefined}
          onShare={() => {
            const url = typeof window !== 'undefined' ? window.location.href : '';
            if (navigator.share) {
              navigator.share({ url }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(url);
              toast.success('Room link copied');
            }
          }}
          onLike={() => toast.success('❤️')}
        />

        {/* PK battle bar (score + timer, active/finished) */}

        <PkBattleBar state={pk.state} onOpen={() => setPkOpen(true)} />

        {/* "X joined" pulses, top-left, above the chat stream */}

        {(isLive || isWaiting) && <RoomJoinFeed events={joinEvents} />}

        {/* Live room chat (message stream + input) */}

        {(isLive || isWaiting) && (
          <RoomChat
            messages={chatMessages}
            selfUserId={selfUserId}
            connected={chatState === 'connected'}
            canChat={canChat}
            isHost={isHost}
            raised={isHost && isWaiting}
            onSend={sendChat}
            onOpenGift={!isHost ? () => setGiftSheetOpen(true) : undefined}
            onOpenMore={() => setMoreOpen(true)}
            onOpenPk={() => setPkOpen(true)}
            onOpenGames={() => toast.info('Games coming soon 🎮')}
            onToggleFilter={isHost ? () => setFilterOpen((v) => !v) : undefined}
            filterOpen={filterOpen}
          />
        )}



        {/* Host controls */}

        {isHost && isWaiting && (

          <HostControls

            isWaiting={isWaiting}

            isLive={isLive}

            onStart={handleStart}

            actionLoading={actionLoading}

            localStreamReady={!!localStreamRef.current}

          />

        )}



        {/* Gift picker (viewers) */}

        {!isHost && giftSheetOpen && room.host?.id && (

          <GiftPickerSheet

            roomId={room.id}

            hostId={room.host.id}

            onClose={() => setGiftSheetOpen(false)}

          />

        )}



        {/* Filter popup */}

        {filterOpen && isHost && (

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

                  className={`rounded-xl border px-2 py-2 text-[11px] transition ${

                    selectedFilter === filter

                      ? 'border-white bg-white text-black'

                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'

                  }`}

                >

                  {filter}

                </button>

              ))}

            </div>

          </div>

        )}



        {/* Viewer loading overlay */}

        {isLive && !viewerConnected && !isHost && (

          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/15 backdrop-blur-[1px]">

            <div className="rounded-3xl border border-white/10 bg-black/45 px-6 py-5 text-center backdrop-blur-xl">

              <Loader2 className="mx-auto h-6 w-6 animate-spin" />

              <p className="mt-3 text-sm font-semibold">Joining the live...</p>

            </div>

          </div>

        )}



        {/* Guest speaker controls */}

        {speakerPublishing && !isHost && (

          <div className="absolute left-[15px] bottom-[154px] z-40 flex items-center gap-2">

            <div className="flex items-center rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[8px] font-semibold backdrop-blur-xl">

              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              You are speaking

            </div>

            <button

              type="button"

              onClick={() => setGuestMicEnabled((v) => !v)}

              className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition ${

                guestMicEnabled ? 'bg-black/45 text-white hover:bg-white/10' : 'bg-white text-black'

              }`}

              aria-label={guestMicEnabled ? 'Mute microphone' : 'Unmute microphone'}

            >

              {guestMicEnabled ? <Mic className="h-[13px] w-[13px]" /> : <MicOff className="h-[13px] w-[13px]" />}

            </button>

          </div>

        )}



        {/* Speaker error */}

        {mediaError && !isHost && (

          <div className="absolute left-[15px] right-[30px] bottom-[150px] z-50 rounded-2xl border border-red-300/20 bg-red-950/70 p-3 text-xs text-red-100 backdrop-blur-xl">

            {mediaError}

          </div>

        )}



        {/* Audio stage modal */}

        {speakerPanelOpen && (
          <AudioStageModal

            isHost={isHost}

            requests={requests}

            speakers={activeSpeakers}

            speakerProfiles={speakerProfiles}

            speakingSpeakerIds={speakingSpeakerIds}

            seatCount={seatCount}

            pending={viewerRequestPending}   // Viewer's own pending state

            requestLoading={actionLoading}

            onRequest={requestAudio}

            onApprove={approve}

            onReject={reject}

            onClose={() => setSpeakerPanelOpen(false)}

            hostName={room.host?.name || 'Host'}

          />

        )}

        {/* PK battle sheet */}

        <PkBattleSheet

          open={pkOpen}

          onClose={() => setPkOpen(false)}

          myUserId={userId}

          isHost={isHost}

          hostName={room.host?.name || 'Host'}

          pk={pk}

        />

      </section>

    </main>

  );

}