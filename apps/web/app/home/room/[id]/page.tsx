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

import { AudioStage } from '@/components/audio/AudioStage';


import { RoomMoreActions } from '@/components/RoomMoreActions';

import { GoLiveSetup } from '@/components/GoLiveSetup';
import { ContributorsModal } from '@/components/ContributorsModal';

import { RoomChat } from '@/components/RoomChat';

import { useRoomOverview } from '@/hooks/useRoomOverview';

import { useRoomTask } from '@/hooks/useRoomTask';
import { useHostCenter } from '@/hooks/useHostCenter';
import { HostTaskCenterModal } from '@/components/room/HostTaskCenterModal';

import { useRoomChallenge } from '@/hooks/useRoomChallenge';

import { TopCards } from '@/components/room/hud/TopCards';

import { useLiveBox } from '@/hooks/useLiveBox';

import { useRoomWishes } from '@/hooks/useRoomWishes';

import { GiftBoxButton, LuckySpinButton, WishBoxButton } from '@/components/room/hud/RightRail';

import { WishBoxSheet } from '@/components/room/hud/WishBoxSheet';

import type { MicMode } from '@/components/RoomChat';

import { useRoomChat } from '@/hooks/useRoomChat';

import { useRoomStage } from '@/hooks/useRoomStage';

import { usePk } from '@/hooks/usePk';

import { usePkMedia } from '@/hooks/usePkMedia';

import { PkBattleBar } from '@/components/PkBattleBar';

import { PkBattleSheet } from '@/components/PkBattleSheet';

import { PkDualVideo } from '@/components/PkDualVideo';

import { PKBattleOverlay } from '@/components/pk/PKBattleOverlay';

import { LastPKCard } from '@/components/pk/LastPKCard';

import { GamesSheet } from '@/components/games/GamesSheet';

import { SubhaLuckyRingGame } from '@/components/SubhaLuckyRingGame';


import { GiftPickerSheet } from '@/components/GiftPickerSheet';

import { GiftSendAnimation, type SentGift } from '@/components/GiftSendAnimation';



import { financialApi, type GiftCatalogItem } from '@/lib/api/financial';

import { roomsApi } from '@/lib/api/rooms';

import { AudioStageModal } from '@/components/AudioStageModal';

import { SpeakerDock, type DockSpeaker } from '@/components/SpeakerDock';

import { ViewerListSheet } from '@/components/ViewerListSheet';

import { UserProfilePopup } from '@/components/room/UserProfilePopup';
import { cameraFilterCss } from '@/lib/camera-filters';
import { preloadGiftImages } from '@/lib/gift-image-cache';



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
  // broken screen. Guarded by `hadRuntimeRef` because `runtime` starts out
  // null for one render too — openRoom() above updates the provider's
  // state asynchronously, so on the very first render here it hasn't
  // landed yet. Without the guard, that transient null looked identical
  // to "session closed" and redirected home immediately after every room
  // was created/opened.
  const hadRuntimeRef = useRef(false);
  useEffect(() => {
    if (runtime) {
      hadRuntimeRef.current = true;
      return;
    }
    if (hadRuntimeRef.current) router.replace('/home');
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
  const cameraFilter = runtime?.cameraFilter ?? 'Natural';
  const cameraFilterBaked = runtime?.cameraFilterBaked ?? false;
  const setCameraFilter = runtime?.setCameraFilter ?? (() => {});
  // The filter is baked into the published video (see filtered-camera.ts),
  // so the host's <video> already shows it — applying the CSS filter on top
  // would double it. Only fall back to CSS when the browser has no WebGL.
  const localPreviewFilter = cameraFilterBaked ? 'none' : cameraFilterCss(cameraFilter);

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
  const { messages: chatMessages, state: chatState, selfUserId, send: sendChat } =
    useRoomChat(room?.id ?? '', room?.status);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);

  // Audio party-room stage (authoritative seats / host / listeners via
  // GET /rooms/:id/stage). Only active for live audio rooms.
  const isAudioRoom = room?.media_type === 'audio';
  const {
    stage: stageSnapshot,
    profiles: stageProfiles,
    report: reportStage,
    leaveSeat: leaveStageSeat,
  } = useRoomStage({
    roomId: room?.id ?? '',
    isLive,
    enabled: !!isAudioRoom && isLive,
  });

  const [sentGift, setSentGift] = useState<SentGift | null>(null);


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

  // Real header data (host public ID, today's top gifters, host rank).
  // Refetched whenever a new gift lands in chat so the leaderboard avatars and
  // the "Top N" pill move with the stream.
  const overview = useRoomOverview(room?.id ?? '', !!room?.id && (isLive || isWaiting), sessionGiftTotals.giftCount);

  // Star Target (room gift goal, set from the admin console) + Regional Star Challenge (host ranking race).
  const {
    task: starTask,
    claiming: starClaiming,
    claim: claimStarTask,
    refetch: refetchStarTask,
  } = useRoomTask(room?.id ?? '', room?.status);

  // Warm every gift image as soon as the room opens, so gift rows, the picker
  // and the send animation render their art instantly instead of downloading
  // it after the gift lands.
  useEffect(() => {
    if (!room?.id) return;
    let cancelled = false;
    financialApi
      .giftCatalog()
      .then((gifts) => {
        if (!cancelled) preloadGiftImages(gifts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [room?.id]);
  const challenge = useRoomChallenge(room?.id ?? '', !!room?.id && isLive, sessionGiftTotals.giftCount);
  // Right rail: watch-time gift box + Wish Box (Lucky Spin reuses the Lucky game).
  const liveBox = useLiveBox(room?.id ?? '', !!room?.id && isLive && !isHost);
  const wishes = useRoomWishes(room?.id ?? '', !!room?.id && isLive, sessionGiftTotals.giftCount);

  useEffect(() => {
    if (sessionGiftTotals.giftCount > 0) void refetchStarTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionGiftTotals.giftCount]);

  // ---- Viewer's own request status ----

const { isPending: viewerRequestPending, isAccepted: viewerRequestAccepted } =
  useViewerRequestStatus(room?.id ?? '', isHost, userId, room?.status);



  // ---- UI state ----

  const [contributorsOpen, setContributorsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [gamesOpen, setGamesOpen] = useState(false);
  const [luckyOpen, setLuckyOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);

  const [micEnabled, setMicEnabled] = useState(true);




  const [speakerPanelOpen, setSpeakerPanelOpen] = useState(false);
  const [moreView, setMoreView] = useState<'menu' | 'levels'>('menu');

  const [viewersOpen, setViewersOpen] = useState(false);
  const [hostTasksOpen, setHostTasksOpen] = useState(false);
  // Host-only Task Center (tabs, gender-filtered by the server).
  const hostCenter = useHostCenter(room?.id ?? '', isHost && !!room?.id && (isLive || isWaiting), hostTasksOpen);

  // Tapping any user (chat, header, viewer list, contributors, PK) opens
  // this in-room popup instead of navigating to /user/[id] and leaving the
  // live stream.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const [guestMicEnabled, setGuestMicEnabled] = useState(true);

  // Audio room stage controls: mute (host or seated guest) + leave seat.
  // `micEnabled` / `guestMicEnabled` are "mic is ON"; the server wants "muted".
  const stageMicOn = isHost ? micEnabled : guestMicEnabled;
  const onStage = isHost || (stageSnapshot?.me.seat ?? null) !== null;
  const handleStageToggleMute = () => {
    // Currently on -> the toggle mutes, so report muted: true (and vice versa).
    if (isHost) setMicEnabled((v) => !v);
    else setGuestMicEnabled((v) => !v);
    void reportStage({ muted: stageMicOn });
  };
  const handleStageLeaveSeat = async () => {
    await leaveStageSeat();
    await refetch();
  };
  const handleStageCancelRequest = async () => {
    if (!room?.id) return;
    await roomsApi.cancelAudioRequest(room.id).catch(() => {});
    await refetch();
  };

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

  // Bottom-bar mic: mute toggle for anyone on stage; otherwise a viewer taps
  // it to request (or cancel a request for) a speaking seat.
  const micMode: MicMode | undefined = isAudioRoom || isHost || onStage
    ? onStage
      ? (isAudioRoom ? stageMicOn : micEnabled) ? 'on' : 'off'
      : viewerRequestPending ? 'pending' : 'request'
    : viewerRequestPending ? 'pending' : 'request';
  const handleMicPress = () => {
    if (onStage) {
      if (isAudioRoom) handleStageToggleMute();
      else if (isHost) setMicEnabled((v) => !v);
      else setGuestMicEnabled((v) => !v);
      return;
    }
    if (isAudioRoom) {
      setSpeakerPanelOpen(true);
      return;
    }
    if (viewerRequestPending) void roomsApi.cancelAudioRequest(room?.id ?? '').then(() => refetch()).catch(() => {});
    else void requestAudio();
  };



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
            filter={localPreviewFilter}
            primaryLabel={isHost ? 'You' : room.host?.name || 'Host'}
            opponentLabel="Opponent"
          />
        ) : isAudioRoom && isLive && stageSnapshot ? (
          <AudioStage
            stage={stageSnapshot}
            profiles={stageProfiles}
            speakingIds={speakingSpeakerIds ?? new Set()}
            currentUserId={userId}
            isHost={isHost}
            roomCoins={sessionGiftTotals.totalDiamonds}
            onOpenSeats={() => setSpeakerPanelOpen(true)}
            onOpenLevels={() => {
              setMoreView('levels');
              setMoreOpen(true);
            }}
            onOpenProfile={setProfileUserId}
          />
        ) : (
          <LiveVideo

            isHost={isHost}

            isWaiting={isWaiting}

            isLive={isLive}

            localStream={localStreamRef.current}

            remoteStream={remoteStreamRef.current}

            filter={localPreviewFilter}

            isAudioRoom={isAudioRoom}

            hostName={room.host?.name}

            hostAvatar={room.host?.avatar}

            speakers={dockSpeakers}

            seatCount={seatCount}

            hostSpeaking={!!room.host_id && (speakingSpeakerIds?.has(room.host_id) ?? false)}

            onOpenSeats={() => setSpeakerPanelOpen(true)}

          />
        )}



        {/* Overlay gradients */}

        {!isAudioRoom && <div className="pointer-events-none absolute inset-0 bg-black/35" />}

        <div className={isAudioRoom ? "pointer-events-none absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-black/45 to-transparent" : "pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/80 via-black/35 to-transparent"} />

        <div className={isAudioRoom ? "pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-black/80 via-black/30 to-transparent" : "pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/95 via-black/50 to-transparent"} />



        {/* Header (the pre-live setup screen has its own top bar) */}
        {!(isHost && isWaiting) && (
          <RoomHeader
            host={room.host}
            viewerCount={room.viewerCount ?? mediaState?.viewerCount ?? 0}
            isLive={isLive}
            onLeave={handleLeave}
            onExplore={handleMinimize}
            onOpenMore={() => {
              setMoreView('menu');
              setMoreOpen(true);
            }}
            currentUserId={userId}
            overview={overview}
            onOpenProfile={setProfileUserId}
            task={task}
            isHost={isHost}
            onClaimTask={isHost ? undefined : claim}
            claimingTask={claiming}
            taskStats={stats}
            onOpenHostTasks={isHost ? () => setHostTasksOpen(true) : undefined}
            hostTaskBadge={hostCenter.claimable}
            onOpenViewers={() => setViewersOpen(true)}
            onOpenContributors={room.host?.id ? () => setContributorsOpen(true) : undefined}
            statusChip={
              isHost && isLive ? (
                <div className="flex items-center rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide backdrop-blur-xl">
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                      hostMediaReady ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'
                    }`}
                  />
                  {hostMediaReady ? 'LIVE' : 'CONNECTING'}
                </div>
              ) : null
            }
            cards={
              isLive || (isWaiting && !isHost) ? (
                <TopCards
                  task={starTask}
                  claiming={starClaiming}
                  onClaimTask={async () => {
                    await claimStarTask().catch(() => {});
                  }}
                  challenge={challenge.data}
                  skewMs={challenge.skewMs}
                  hostId={room.host_id}
                />
              ) : null
            }
            footer={isLive && !pk.state ? <LastPKCard hostId={room.host_id} onView={() => setPkOpen(true)} /> : null}
          />
        )}

        {/* Always-visible speaker dock: shows connected speakers over the
            camera feed for video rooms. Audio rooms already render every
            seat inline as the stage background (see LiveVideo), so the
            dock would just duplicate it there. */}

        {room.media_type !== "audio" && !(isHost && isWaiting) && (
          <SpeakerDock speakers={dockSpeakers} topOffset={330} side="left" />
        )}



        {/* Secondary actions live in a "more" sheet, opened from the chat bar,
            so the bottom edge stays to one clean row (chat + gift). */}
        <RoomMoreActions
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          isHost={isHost}
          isAudioRoom={room.media_type === "audio"}
          view={moreView}
          onViewChange={setMoreView}
          stage={
            isAudioRoom && isLive
              ? {
                  onStage,
                  isHost,
                  requestPending: stageSnapshot?.me.requestPending ?? false,
                  loading: actionLoading,
                  pendingCount: pendingRequestCount,
                  roomCoins: sessionGiftTotals.totalDiamonds,
                  seatCount,
                  onLeaveSeat: handleStageLeaveSeat,
                  onRequest: () => setSpeakerPanelOpen(true),
                  onCancelRequest: handleStageCancelRequest,
                  onManage: () => setSpeakerPanelOpen(true),
                }
              : undefined
          }
          onShare={() => {
            const url = typeof window !== 'undefined' ? window.location.href : '';
            if (navigator.share) {
              navigator.share({ url }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(url);
              toast.success('Room link copied');
            }
          }}

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

        {/* Live room chat (message stream + input) */}

        {(isLive || (isWaiting && !isHost)) && (
          <RoomChat
            messages={chatMessages}
            selfUserId={selfUserId}
            connected={chatState === 'connected'}
            isHost={isHost}
            onSend={sendChat}
            onOpenGift={!isHost ? () => setGiftSheetOpen(true) : undefined}
            onOpenPk={isHost ? () => setPkOpen(true) : undefined}
            onOpenGames={() => setGamesOpen(true)}
            onOpenGuests={() => setSpeakerPanelOpen(true)}
            guestBadge={pendingRequestCount}
            micMode={micMode}
            onMicPress={handleMicPress}
            onOpenProfile={setProfileUserId}
          />
        )}



        {/* Pre-live setup: camera preview + filters + the big Start button */}
        {isHost && isWaiting && (
          <GoLiveSetup
            title={room.title}
            isAudioRoom={room.media_type === 'audio'}
            hostAvatar={room.host?.avatar}
            filter={cameraFilter}
            onFilterChange={setCameraFilter}
            filterBaked={cameraFilterBaked}
            ready={!!localStreamRef.current}
            starting={actionLoading}
            error={mediaError}
            onStart={handleStart}
            onClose={handleLeave}
          />
        )}

        {/* Gift picker (viewers) */}

        {!isHost && giftSheetOpen && room.host?.id && (

          <GiftPickerSheet

            roomId={room.id}

            hostId={room.host.id}

            onClose={() => setGiftSheetOpen(false)}

            onSent={(gift, position, quantity) => {
              setSentGift({
                code: gift.code,
                icon: gift.icon,
                name: gift.name,
                position,
                quantity,
                coinPrice: gift.coinPrice,
                nonce: Date.now(),
              });
            }}

          />

        )}



        {/* Gift-sent celebration: replaces the old success toast */}

        {sentGift && (

          <GiftSendAnimation key={sentGift.nonce} gift={sentGift} onDone={() => setSentGift(null)} />

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

          <div className="absolute right-[15px] bottom-[86px] z-40 flex items-center gap-2">

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



        {/* Top contributors (opened from the trophy icon in the header) */}
        {contributorsOpen && room.host?.id && (
          <ContributorsModal
            hostId={room.host.id}
            hostName={room.host.name || 'Host'}
            onClose={() => setContributorsOpen(false)}
            onOpenProfile={setProfileUserId}
          />
        )}

        {/* Viewer list */}

        {isHost && (
          <HostTaskCenterModal
            open={hostTasksOpen}
            onClose={() => setHostTasksOpen(false)}
            data={hostCenter.data}
            loading={hostCenter.loading}
            claimingId={hostCenter.claimingId}
            onClaim={(id) => void hostCenter.claim(id)}
          />
        )}

        {viewersOpen && (
          <ViewerListSheet
            viewerIds={viewerIds}
            onClose={() => setViewersOpen(false)}
            onOpenProfile={setProfileUserId}
          />
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

          onOpenProfile={setProfileUserId}

        />

        {/* Right rail: gift box · lucky spin · wish box */}
        {isLive && room?.id && (
          <div className="absolute right-3 top-[300px] z-30 flex flex-col items-center gap-3">
            {!isHost && liveBox.status?.available && (
              <GiftBoxButton
                status={liveBox.status}
                remainingMs={liveBox.remainingMs}
                ready={liveBox.ready}
                exhausted={liveBox.exhausted}
                claiming={liveBox.claiming}
                onPress={() => {
                  if (liveBox.ready) void liveBox.claim();
                  else if (liveBox.exhausted) toast.info("You've opened all of today's gift boxes");
                  else toast.info('Keep watching — your gift box opens when the timer ends');
                }}
              />
            )}
            <LuckySpinButton onPress={() => setLuckyOpen(true)} />
            {(isHost || (wishes.data?.total ?? 0) > 0) && (
              <WishBoxButton
                fulfilled={wishes.data?.fulfilled ?? 0}
                total={wishes.data?.total ?? 0}
                onPress={() => setWishOpen(true)}
              />
            )}
          </div>
        )}
        {wishOpen && (
          <WishBoxSheet
            data={wishes.data}
            isHost={isHost}
            saving={wishes.saving}
            onClose={() => setWishOpen(false)}
            onSave={wishes.save}
            onSendGift={() => setGiftSheetOpen(true)}
          />
        )}

        {/* Games launcher + Subha Lucky game */}
        <GamesSheet
          open={gamesOpen}
          onClose={() => setGamesOpen(false)}
          onPlayLucky={() => {
            setGamesOpen(false);
            setLuckyOpen(true);
          }}
          onPlayTeenPatti={() => {
            // Solo game lives on its own page: keep the live room running in
            // the mini player (same as "minimize") while the user plays.
            setGamesOpen(false);
            minimize();
            router.push('/home/party/games/teen-patti');
          }}
        />

        {luckyOpen && room?.id && (
          <SubhaLuckyRingGame roomId={room.id} onClose={() => setLuckyOpen(false)} />
        )}

        {/* User profile popu p — opened from chat, header, viewer list,
            contributors, or PK; slides up from the bottom over the live
            stream instead of navigating to a full profile page. */}
        {profileUserId && (
          <UserProfilePopup
            userId={profileUserId}
            currentUserId={userId}
            onClose={() => setProfileUserId(null)}
          />
        )}

      </section>

    </main>

  );

}