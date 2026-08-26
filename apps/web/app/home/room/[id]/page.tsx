'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Headphones, Mic, MicOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { roomsApi } from '@/lib/api/rooms';
import { useRoom } from '@/hooks/useRoom';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSpeakerRequests } from '@/hooks/useSpeakerRequests';
import { useViewerRequestStatus } from '@/hooks/useViewerRequestStatus';
import { RoomHeader } from '@/components/RoomHeader';
import { LiveVideo } from '@/components/LiveVideo';
import { BottomBar } from '@/components/BottomBar';
import { HostControls } from '@/components/HostControls';
import { AudioStageModal } from '@/components/AudioStageModal';

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
    localStreamRef,
    remoteStreamRef,
    startHost,
    joinViewer,
    leave,
  } = useWebRTC(room, userId);

  // ---- Speaker Requests (host) ----
  const {
    requests,
    pending: hostRequestPending,
    requestAudio,
    approve,
    reject,
  } = useSpeakerRequests(room?.id ?? '', isHost);

  // ---- Viewer's own request status ----
  const { isPending: viewerRequestPending } = useViewerRequestStatus(room?.id ?? '', isHost, userId);

  // ---- UI state ----
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Natural');
  const [speakerPanelOpen, setSpeakerPanelOpen] = useState(false);
  const [guestMicEnabled, setGuestMicEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ---- Handlers ----
  const handleStart = useCallback(async () => {
    if (!room) return;
    setActionLoading(true);
    try {
      await startHost(room);
      toast.success("You're live");
      refetch();
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
        <LiveVideo
          isHost={isHost}
          isWaiting={isWaiting}
          isLive={isLive}
          localStream={localStreamRef.current}
          remoteStream={remoteStreamRef.current}
          filter={filterPresets[selectedFilter as keyof typeof filterPresets]}
        />

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
          aria-label={`Open audio stage. ${occupiedSeats} of ${seatCount} occupied`}
          className="absolute right-[13px] top-1/2 z-40 flex h-[29px] w-[29px] -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-xl"
        >
          <Headphones className="h-[13px] w-[13px]" strokeWidth={1.6} />
          {occupiedSeats > 0 && (
            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
              {occupiedSeats}
            </span>
          )}
        </button>

        {/* Bottom bar */}
        <BottomBar isHost={isHost} />

        {/* Host controls */}
        {isHost && (isWaiting || isLive) && (
          <HostControls
            isWaiting={isWaiting}
            isLive={isLive}
            micEnabled={micEnabled}
            onToggleMic={() => setMicEnabled((v) => !v)}
            filterOpen={filterOpen}
            onToggleFilter={() => setFilterOpen((v) => !v)}
            onStart={handleStart}
            actionLoading={actionLoading}
            localStreamReady={!!localStreamRef.current}
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
      </section>
    </main>
  );
}