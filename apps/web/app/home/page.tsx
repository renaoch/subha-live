'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Calendar, ChevronRight, Eye, Flame, Home, MapPin, MessageCircle, Plus, Search, Sparkles, User, Users } from 'lucide-react';

import { roomsApi, type RoomRecord } from '@/lib/api/rooms';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const TABS = ['For You', 'Following', 'Nearby', 'PK', 'New'] as const;
type Tab = (typeof TABS)[number];

export default function LiveFeedPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('For You');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  const goLive = () => router.push('/home?create=1');
  const openRoom = (id: string) => router.push(`/home/room/${id}`);
  const comingSoon = (what: string) => () => toast.info(`${what} coming soon`);

  return (
    <main className="min-h-dvh bg-[#0a0a0a] pb-28 text-white font-sans selection:bg-orange-500/30">
      {/* Decorative background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-orange-600/10 blur-[80px]" />
        <div className="absolute top-40 -right-20 h-64 w-64 rounded-full bg-orange-500/5 blur-[80px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Mascot Icon */}
              <div className="relative flex h-10 w-10 items-center justify-center">
                <img 
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=Subha&backgroundColor=ff9a00" 
                  alt="Subha" 
                  className="h-full w-full object-contain drop-shadow-[0_0_10px_rgba(255,154,0,0.5)]"
                />
                <span className="absolute -right-1 -top-1 text-orange-400">✦</span>
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-white flex items-center gap-1">
                  Subha <span className="text-orange-400 text-lg">✦</span>
                </h1>
                <p className="text-[10px] font-medium text-white/50 tracking-wide uppercase">Live People. Real Connection.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={comingSoon('Search')}
                aria-label="Search"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 active:scale-95"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={comingSoon('Notifications')}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 active:scale-95"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-[#0a0a0a]" />
              </button>
              <button 
                onClick={comingSoon('Profile')}
                className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 p-[1px]"
              >
                 <div className="h-full w-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="h-4 w-4 text-white/80" />
                 </div>
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

        <div className="space-y-6 px-4 pt-2">
          {/* Go Live Hero Card */}
          <button
            type="button"
            onClick={goLive}
            className="group relative block w-full overflow-hidden rounded-[24px] border border-orange-500/30 bg-black text-left shadow-[0_0_30px_-10px_rgba(255,140,0,0.3)] transition-transform duration-200 active:scale-[0.98]"
          >
            {/* Background Image */}
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[70%_20%] opacity-80 transition duration-500 group-active:scale-105"
            />

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            <div className="relative flex aspect-[2.2/1] min-h-[170px] flex-col justify-center px-5 py-4">
              <div className="max-w-[65%]">
                <p className="font-display text-4xl font-extrabold leading-none tracking-tight text-white drop-shadow-md">
                  Go Live
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold italic leading-none tracking-tight text-orange-400 drop-shadow-md">
                  Be Yourself
                </p>
                <p className="mt-2 text-xs font-medium text-white/70">
                  Share your world with Subha
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-orange-500/20 transition-transform group-active:scale-95">
                  Go Live
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>

          {/* Daily Check-in Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-950/40 to-black/40 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Daily Check-in</h3>
                <p className="text-xs text-white/50">Log in every day for bonus coins</p>
              </div>
            </div>
            <div className="relative">
               <Calendar className="h-8 w-8 text-orange-400/80" />
               <div className="absolute inset-0 flex items-center justify-center pt-1">
                  <span className="text-[10px] font-bold text-black">✓</span>
               </div>
            </div>
          </div>

          {/* Popular Live Section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
                Popular Live
              </h2>
              <button
                type="button"
                onClick={() => toast.info('See all coming soon')}
                className="text-xs font-medium text-white/50 transition-colors hover:text-orange-400"
              >
                See All &gt;
              </button>
            </div>

            {loading ? (
              <SkeletonGrid count={2} />
            ) : popular.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {popular.map((room) => (
                  <RoomCard key={room.id} room={room} onClick={() => openRoom(room.id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/90 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between relative">
          <button onClick={comingSoon('Home')} className="flex flex-col items-center gap-1 text-orange-400">
            <Home className="h-6 w-6 fill-orange-400/20" />
          </button>
          
          <button onClick={comingSoon('Party')} className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70">
            <Sparkles className="h-6 w-6" />
          </button>

          {/* Center Plus Button */}
          <div className="relative -top-5">
            <button 
              onClick={goLive}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.5)] transition-transform active:scale-90"
            >
              <Plus className="h-7 w-7 text-black" strokeWidth={3} />
            </button>
          </div>

          <button onClick={comingSoon('Messages')} className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70">
            <MessageCircle className="h-6 w-6" />
          </button>

          <button onClick={comingSoon('Profile')} className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70">
            <User className="h-6 w-6" />
          </button>
        </div>
      </nav>
    </main>
  );
}

function RoomCard({
  room,
  onClick,
}: {
  room: RoomRecord;
  onClick: () => void;
}) {
  const name = room.host?.name ?? 'Host';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a1a] text-left shadow-lg transition duration-200 active:scale-[0.97]"
    >
      <div className="aspect-[3/4] w-full relative">
        {room.cover ? (
          <img
            src={room.cover}
            alt={room.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-active:scale-105"
          />
        ) : room.host?.avatar ? (
          <img
            src={room.host.avatar}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover blur-[2px] brightness-[0.6] transition duration-300 group-active:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Avatar name={name} size="lg" className="h-16 w-16 text-2xl opacity-50" />
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10 opacity-90" />

        {/* Top Badges */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-black shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-black animate-pulse" />
            LIVE
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            <Eye className="h-3 w-3" />
            {formatCount(room.viewerCount ?? 0)}
          </span>
        </div>

        {/* Bottom Info */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-center gap-2">
             <Avatar name={name} src={room.host?.avatar ?? undefined} size="sm" className="h-6 w-6 border border-white/20" />
             <div className="flex flex-col">
                <span className="truncate text-xs font-bold text-white leading-tight">{name}</span>
                <span className="truncate text-[10px] text-white/60">{room.title || 'Party time 🎉'}</span>
             </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/5 bg-white/5"
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
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