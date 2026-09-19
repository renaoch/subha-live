'use client';



import { use, useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { Loader2, Mic, MicOff } from 'lucide-react';

import { useRoomSession } from '@/lib/room-session-context';

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

import { PKBattleOverlay } from '@/components/pk/PKBattleOverlay';

import { LastPKCard } from '@/components/pk/LastPKCard';


import { GiftPickerSheet } from '@/components/GiftPickerSheet';

import { GiftSendAnimation, type SentGift } from '@/components/GiftSendAnimation';

import { HostGiftMeter } from '@/components/HostGiftMeter';

import { WalletBalancePill } from '@/components/WalletBalancePill';

import { financialApi, type GiftCatalogItem } from '@/lib/api/financial';

import { AudioStageModal } from '@/components/AudioStageModal';

import { SpeakerDock, type DockSpeaker } from '@/components/SpeakerDock';

import { ViewerListSheet } from '@/components/ViewerListSheet';



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

  // ---- Shared room session (survives navigation — see room-session-context) ----

  const { openRoom, minimize, closeRoom, runtime } = useRoomSession();

  useEffect(() => {
    openRoom(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // If the shared session was closed out from under this route (host ended
  // the room, or it was explicitly left from the mini player), there's
  // nothing left to show here — bounce back to Home instead of rendering a
  // broken screen.
  useEffect(() => {
    if (runtime === null) router.replace('/home');
  }, [runtime, router]);

  const userId = runtime?.userId ?? null;
  const room = runtime?.room ?? null;
  const isLoading = runtime?.roomLoading ?? true;
  const isError = runtime?.roomError ?? false;
  const refetch = runtime?.refetchRoom ?? (() => {});
  const isHost = runtime?.isHost ?? false;
  const isLive = runtime?.isLive ?? false;
  const isWaiting = runtime?.isWaiting ?? false;

  const hostPublishing = runtime?.hostPublishing ?? false;
  const hostMediaReady = runtime?.hostMediaReady ?? false;
  const viewerConnected = runtime?.viewerConnected ?? false;
  const speakerPublishing = runtime?.speakerPublishing ?? false;
  const mediaError = runtime?.mediaError ?? '';
  const mediaState = runtime?.mediaState;
  const speakingSpeakerIds = runtime?.speakingSpeakerIds;
  const localStreamRef = runtime?.localStreamRef ?? { current: null };
  const remoteStreamRef = runtime?.remoteStreamRef ?? { current: null };
  const publishGuestAudio = runtime?.publishGuestAudio ?? (async () => {});

  // Connection lifecycle now lives in the shared session (room-session-
  // context) so it survives navigating away from this route. This page
  // just calls into it and handles its own navigation on top.
  const actionLoading = runtime?.actionLoading ?? false;
  const handleStart = runtime?.handleStart ?? (async () => {});
  const handleJoin = runtime?.handleJoin ?? (async () => {});
  const handleEnd = runtime?.handleEnd ?? (async () => {});

  // Full leave: disconnect, clear the shared session, and navigate home.
  // Contrast with "minimize" below, which keeps the connection alive.
  const handleLeave = useCallback(async () => {
    await (runtime?.handleLeave ?? (async () => {}))();
    closeRoom();
    router.push('/home');
  }, [runtime, closeRoom, router]);

  // Minimize: keep the connection alive in RoomSessionProvider and drop
  // into the floating mini player instead of disconnecting.
  const handleMinimize = useCallback(() => {
    minimize();
    router.push('/home');
  }, [minimize, router]);





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

  const [sentGift, setSentGift] = useState<SentGift | null>(null);

  // Bumped every time this viewer sends a gift, so WalletBalancePill knows
  // to re-fetch the authoritative balance from the server (never computed
  // locally — see fin_send_gift() in the financial-system migration).
  const [walletRefreshToken, setWalletRefreshToken] = useState(0);

  // Public gift catalog (id -> diamondValue), fetched once, used only to
  // render the live "gifts this stream" meter below — same data the gift
  // picker already shows, never anything balance/ledger related.
  const [giftDiamondValues, setGiftDiamondValues] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    financialApi
      .giftCatalog()
      .then((catalog: GiftCatalogItem[]) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const g of catalog) map[g.id] = g.diamondValue;
        setGiftDiamondValues(map);
      })
      .catch(() => {
        /* Meter just stays hidden if the catalog can't be loaded. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Running total of diamonds represented by gift rows already seen in
  // this room's live chat feed this session — a read-only crowd meter,
  // not the source of truth for anyone's actual earnings/balance.
  const sessionGiftTotals = useMemo(() => {
    let totalDiamonds = 0;
    let giftCount = 0;
    for (const m of chatMessages) {
      if (m.kind === 'gift' && m.gift) {
        const value = giftDiamondValues[m.gift.giftId] ?? 0;
        totalDiamonds += value * (m.gift.quantity || 1);
        giftCount += 1;
      }
    }
    return { totalDiamonds, giftCount };
  }, [chatMessages, giftDiamondValues]);

  // PK battle (1v1) state + actions.
  const pk = usePk(room?.id ?? '', userId, isHost, room?.status);
  const [pkOpen, setPkOpen] = useState(false);

  // Once the battle actually goes ACTIVE, the sheet's job (invite/accept/
  // start) is done — close it so it doesn't sit on top of (and hide) the
  // start animation and the clean active-battle UI underneath. Reopening
  // is still one tap away via the score bar or the "Last PK" card.
  useEffect(() => {
    if (pk.state?.status === 'ACTIVE') setPkOpen(false);
  }, [pk.state?.status]);


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

  const [viewersOpen, setViewersOpen] = useState(false);

  const [guestMicEnabled, setGuestMicEnabled] = useState(true);

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
  // Connect/disconnect + start/join/end now live in RoomSessionProvider
  // (handleStart/handleJoin/handleEnd/handleLeave defined above) so they
  // survive navigating away from this route. Only per-route UI effects
  // stay here.

useEffect(() => {
  if (isHost || !viewerRequestAccepted || speakerPublishing) return;
  console.log('[GUEST-DEBUG] page.tsx effect triggering publishGuestAudio (viewerRequestAccepted=true)');
  publishGuestAudio().catch((e) => {
    console.error('[handleGuestAutoPublish] failed:', e);
  });
}, [isHost, viewerRequestAccepted, speakerPublishing, publishGuestAudio]);

  // ---- Derived ----

  const activeSpeakers = useMemo(() => {

    return mediaState ? Object.values(mediaState.speakers) : [];

  }, [mediaState]);

  const seatCount = room?.max_guest_slots ?? 3;

  // Real connected viewer ids from the room's live media state (SFU
  // presence), excluding the host and any on-stage speakers so this list
  // is purely "people watching" as advertised — no invented names.
  const viewerIds = useMemo(() => {
    if (!mediaState?.viewers) return [];
    const speakerIds = new Set(activeSpeakers.map((s) => s.userId));
    return Object.keys(mediaState.viewers).filter(
      (id) => id !== room?.host_id && !speakerIds.has(id),
    );
  }, [mediaState, activeSpeakers, room?.host_id]);

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

          <p className="text-lg font-bold">
            {isError ? "Couldn't load this room" : 'Room not found'}
          </p>

          {isError && (
            <p className="mt-1 text-sm text-white/60">
              Check your connection and try again.
            </p>
          )}

          <div className="mt-3 flex items-center justify-center gap-2">
            {isError && (
              <button
                onClick={() => refetch()}
                className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            )}

            <button

              onClick={() => router.push('/home')}

              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"

            >

              Back home

            </button>
          </div>

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

            isAudioRoom={room.media_type === "audio"}

            hostName={room.host?.name}

            hostAvatar={room.host?.avatar}

            speakers={dockSpeakers}

            seatCount={seatCount}

            hostSpeaking={!!room.host_id && (speakingSpeakerIds?.has(room.host_id) ?? false)}

            onOpenSeats={() => setSpeakerPanelOpen(true)}

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

          onMinimize={handleMinimize}

          currentUserId={userId}

          task={task}

          isHost={isHost}

          onClaimTask={isHost ? undefined : claim}

          claimingTask={claiming}

          taskStats={stats}

          onOpenViewers={() => setViewersOpen(true)}

        />

        {/* Live "gifts this stream" meter — visible to everyone in the
            room, host and viewers alike, tallied from the same gift rows
            already shown in chat. */}
        <HostGiftMeter
          totalDiamonds={sessionGiftTotals.totalDiamonds}
          giftCount={sessionGiftTotals.giftCount}
        />

        {/* Viewer's own coin balance — visible at a glance in the room,
            not just inside the gift sheet. Hidden for the host, whose
            header already shows task/earnings stats. */}
        {!isHost && (
          <WalletBalancePill
            className="absolute right-4 top-[80px] z-30"
            refreshToken={walletRefreshToken}
          />
        )}



        {/* Live indicator for host */}

        {isHost && isLive && (

          <div className="absolute left-1/2 top-[46px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-semibold tracking-wide backdrop-blur-xl">

            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                hostMediaReady ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'
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



        {/* Always-visible speaker dock: shows connected speakers over the
            camera feed for video rooms. Audio rooms already render every
            seat inline as the stage background (see LiveVideo), so the
            dock would just duplicate it there. */}

        {room.media_type !== "audio" && (
          <SpeakerDock speakers={dockSpeakers} topOffset={100} />
        )}



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
          isAudioRoom={room.media_type === "audio"}
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

        <PkBattleBar
          state={pk.state}
          onOpen={() => setPkOpen(true)}
          roomHostId={room.host_id}
          hostName={room.host?.name}
          hostAvatar={room.host?.avatar}
        />

        {/* One-shot PK animations: start intro/countdown and end-of-battle
            result, driven by the real PK lifecycle. Renders nothing while
            no PK is active/finishing. */}
        <PKBattleOverlay
          state={pk.state}
          roomHostId={room.host_id}
          hostName={room.host?.name}
          hostAvatar={room.host?.avatar}
        />

        {/* "Last PK" achievement card, only while live and no PK is running. */}
        {isLive && !pk.state && (
          <div className="absolute inset-x-0 top-[104px] z-30 mx-4">
            <LastPKCard hostId={room.host_id} onView={() => setPkOpen(true)} />
          </div>
        )}

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

            onSent={(gift, position) => {
              setSentGift({ code: gift.code, icon: gift.icon, name: gift.name, position });
              setWalletRefreshToken((t) => t + 1);
            }}

          />

        )}



        {/* Gift-sent celebration: replaces the old success toast */}

        {sentGift && (

          <GiftSendAnimation gift={sentGift} onDone={() => setSentGift(null)} />

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



        {/* Viewer list */}

        {viewersOpen && (
          <ViewerListSheet viewerIds={viewerIds} onClose={() => setViewersOpen(false)} />
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