'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Eye, Flame, Loader2, MapPin, Search, Crown, X } from 'lucide-react';

import { roomsApi, type RoomRecord } from '@/lib/api/rooms';
import { useCreateRoom } from '@/hooks/queries/use-rooms';
import { useRoomEntryGuard } from '@/lib/room-session-context';
import { Avatar } from '@/components/ui/avatar';
import { BannerCarousel } from '@/components/BannerCarousel';
import { getPromoBanners } from '@/lib/promo-banners';
import { SubhaLogo } from '@/components/SubhaLogo'; 
import { cn } from '@/lib/utils';

const TABS = ['For You', 'Following', 'Nearby', 'PK', 'New'] as const;
type Tab = (typeof TABS)[number];

export default function LiveFeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('For You');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const promoBanners = useMemo(() => getPromoBanners(), []);

  const createRoomMutation = useCreateRoom();
  const { enterRoom, guardCreate } = useRoomEntryGuard();

  const openCreateModal = () => {
    if (!guardCreate()) return;
    setShowCreateModal(true);
  };

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    roomsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setRooms(data.filter((r) => r.status === 'live'));
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load live rooms");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byViewers = useMemo(
    () => [...rooms].sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0)),
    [rooms],
  );
  const popular = byViewers.slice(0, 4);
  const recommended = byViewers.slice(4, 6);
  const nearby = byViewers.slice(6, 9);

  const openRoom = (id: string) => enterRoom(id);
  const comingSoon = (what: string) => () => toast.info(`${what} coming soon`);

  const closeCreateModal = () => {
    if (createRoomMutation.isPending) return;
    setShowCreateModal(false);
    setStreamTitle('');
    router.replace('/home');
  };

  const startStream = async () => {
    if (!guardCreate()) return;
    try {
      const room = await createRoomMutation.mutateAsync({
        title: streamTitle.trim() || 'Live now',
        livekit_room_name: `subha-live-${crypto.randomUUID()}`,
        category: 'explore',
        media_type: 'video',
      });
      setShowCreateModal(false);
      setStreamTitle('');
      router.push(`/home/room/${room.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the stream");
    }
  };

  return (
    <main className="min-h-dvh bg-[#0a0a0a] pb-6 text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
      
      {/* Create Live Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1a] p-6 text-center shadow-2xl">
            <button 
              onClick={closeCreateModal}
              className="absolute right-4 top-4 text-white/50 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
              <Crown className="h-8 w-8" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">Start Your Live Stream</h2>
            <p className="mt-2 text-sm text-white/60">
              Give your stream a title. You'll set up your camera and mic on the next screen.
            </p>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="What's happening?"
              maxLength={80}
              autoFocus
              className="mt-5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-500/50"
            />
            <button
              onClick={startStream}
              disabled={createRoomMutation.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 py-3 text-sm font-bold text-black transition-transform active:scale-95 disabled:opacity-70"
            >
              {createRoomMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                'Start Streaming'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-30 px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[150%] h-40 bg-orange-500/10 blur-[60px] rounded-[100%]" />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2">
          
          {/* Logo Area */}
          <div className="relative flex flex-col items-start">
            
            {/* The Mascot (image.png) - Scaled down for the smaller logo */}
            <div className="absolute -top-6 left-[2rem] z-20 w-9 h-9">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/image.png" 
                alt="Subha Mascot" 
                className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]"
              />
            </div>

            {/* The Custom SVG Logo - Made 45% smaller (180px * 0.55 = 99px) */}
            <div className="relative mt-1">
              <SubhaLogo className="w-[99px] h-auto drop-shadow-[0_0_15px_rgba(255,154,0,0.3)]" />
            </div>

            {/* Tagline */}
            <p className="text-[8px] font-medium text-white/70 tracking-wide mt-0.5 ml-0.5">
              Live People. Real Connection.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={comingSoon('Search')}
              aria-label="Search"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 active:scale-95"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            
            <button
              type="button"
              onClick={comingSoon('Notifications')}
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 active:scale-95"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-[#0a0a0a]" />
            </button>

            {/* Go Live Button */}
            <button
              onClick={() => openCreateModal()}
              className="relative flex items-center gap-1.5 rounded-full border border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-orange-600/10 px-3.5 py-1.5 text-[11px] font-bold text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)] transition-transform active:scale-95"
            >
              <Crown className="h-3 w-3 fill-orange-400" />
              Go Live
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <nav className="mt-4 -mx-4 flex gap-6 overflow-x-auto px-4 text-sm font-semibold text-white/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative shrink-0 pb-2 transition-colors',
                activeTab === tab ? 'text-orange-400' : 'hover:text-white/70',
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="space-y-8 px-4 pt-4">
        {/* Go Live hero */}
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="group relative block w-full overflow-hidden rounded-[28px] bg-[#1a1a1a] text-left transition active:scale-[0.98] border border-orange-500/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1591853725932-79227eb926b5?auto=format&fit=crop&w=1200&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[75%_20%] transition duration-300 group-active:scale-105"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/10" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />

          <div className="relative flex min-h-[220px] items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display text-[26px] font-extrabold leading-tight text-white drop-shadow-sm">
                Go Live
              </p>
              <p className="font-display text-[26px] font-extrabold italic leading-tight text-orange-400 drop-shadow-sm">
                Be Yourself
              </p>
              <p className="mt-1.5 text-xs text-white/70">Share your world with Subha</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-orange-500/20 transition group-active:scale-95">
                Go Live <span aria-hidden>→</span>
              </span>
            </div>
            <span className="relative hidden shrink-0 self-start pt-1 font-display text-lg italic leading-tight text-orange-400/90 drop-shadow-sm sm:block">
              More
              <br />
              Than Live
            </span>
          </div>
        </button>

        {/* Promo carousel */}
        <BannerCarousel items={promoBanners} />

        {/* Popular Live */}
        <Section icon={<Flame className="h-4 w-4 text-orange-500" />} title="Popular Live">
          {loading ? (
            <SkeletonGrid count={4} />
          ) : popular.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {popular.map((room) => (
                <RoomCard key={room.id} room={room} onClick={() => openRoom(room.id)} />
              ))}
            </div>
          )}
        </Section>

        {/* Recommended For You */}
        <Section title="Recommended For You">
          {loading ? (
            <SkeletonGrid count={2} tall />
          ) : recommended.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recommended.map((room) => (
                <RoomCard key={room.id} room={room} tall onClick={() => openRoom(room.id)} />
              ))}
            </div>
          )}
        </Section>

        {/* Nearby */}
        <Section icon={<MapPin className="h-4 w-4 text-orange-500" />} title="Nearby">
          {loading ? (
            <SkeletonGrid count={3} />
          ) : nearby.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {nearby.map((room) => (
                <RoomCard key={room.id} room={room} compact onClick={() => openRoom(room.id)} />
              ))}
            </div>
          )}
        </Section>
      </div>

    </main>
  );
}

// --- Helper Components ---

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-base font-bold">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={() => toast.info('Coming soon')}
          className="text-xs font-medium text-white/50 transition-colors hover:text-orange-400"
        >
          See All ›
        </button>
      </div>
      {children}
    </section>
  );
}

function RoomCard({
  room,
  onClick,
  tall,
  compact,
}: {
  room: RoomRecord;
  onClick: () => void;
  tall?: boolean;
  compact?: boolean;
}) {
  const name = room.host?.name ?? 'Host';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative block w-full overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a1a] text-left shadow-lg transition duration-200 active:scale-[0.97]',
        compact ? 'aspect-[3/4]' : tall ? 'aspect-[4/5]' : 'aspect-[3/4]',
      )}
    >
      {room.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={room.cover}
          alt={room.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-active:scale-105"
        />
      ) : room.host?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={room.host.avatar}
          alt={name}
          className="absolute inset-0 h-full w-full scale-110 object-cover object-top blur-[2px] brightness-[0.65] transition duration-300 group-active:scale-115"
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900',
          )}
        >
          <Avatar name={name} size="lg" className="h-16 w-16 text-2xl opacity-90" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/25 transition-opacity group-active:from-black/95" />

      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.15)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
          LIVE
        </span>
        <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Eye className="h-2.5 w-2.5" />
          {formatCount(room.viewerCount ?? 0)}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        {!compact && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <Avatar name={name} src={room.host?.avatar ?? undefined} size="sm" className="h-6 w-6 border border-white/30" />
            <span className="truncate text-xs font-bold text-white">{name}</span>
            {room.host?.is_verified && (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white">
                ✓
              </span>
            )}
          </div>
        )}
        <p className="truncate text-[11px] text-white/80">{room.title || 'Live now'}</p>
      </div>
    </button>
  );
}

function SkeletonGrid({ count, tall }: { count: number; tall?: boolean }) {
  return (
    <div className={cn('grid gap-3', count === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'relative overflow-hidden rounded-2xl border border-white/5 bg-white/5',
            tall ? 'aspect-[4/5]' : 'aspect-[3/4]',
          )}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg">
        📡
      </span>
      <p className="text-sm font-medium text-white/60">No one's live right now</p>
      <p className="text-xs text-white/40">Be the first — tap Go Live above.</p>
    </div>
  );
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}