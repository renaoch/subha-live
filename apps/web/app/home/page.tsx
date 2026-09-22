'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Eye, Flame, MapPin, Search, Sparkles } from 'lucide-react';

import { roomsApi, type RoomRecord } from '@/lib/api/rooms';
import { Avatar } from '@/components/ui/avatar';
import { BannerCarousel } from '@/components/BannerCarousel';
import { getPromoBanners } from '@/lib/promo-banners';
import { cn } from '@/lib/utils';

const TABS = ['For You', 'Following', 'Nearby', 'PK', 'New'] as const;
type Tab = (typeof TABS)[number];

export default function LiveFeedPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('For You');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const promoBanners = useMemo(() => getPromoBanners(), []);

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

  // No dedicated "popular" / "recommended" / "nearby" endpoints yet — split
  // the one live-rooms list into feed sections client-side, ranked by
  // viewer count. Swap these slices for real endpoints as they land.
  const byViewers = useMemo(
    () => [...rooms].sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0)),
    [rooms],
  );
  const popular = byViewers.slice(0, 4);
  const recommended = byViewers.slice(4, 6);
  const nearby = byViewers.slice(6, 9);

  const goLive = () => router.push('/home?create=1');
  const openRoom = (id: string) => router.push(`/home/room/${id}`);
  const comingSoon = (what: string) => () => toast.info(`${what} coming soon`);

  return (
    <main className="min-h-dvh bg-surface pb-28 text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/80 px-4 pb-3 pt-[calc(1.1rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              Subha{' '}
              <span className="bg-gradient-to-r from-accent-hot to-accent-gold bg-clip-text text-transparent">
                Live
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-ink-faint">Live People. Real Connection.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={comingSoon('Search')}
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised/70 text-ink-muted transition-colors hover:border-accent-hot/40 hover:text-ink active:scale-95"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={comingSoon('Notifications')}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised/70 text-ink-muted transition-colors hover:border-accent-hot/40 hover:text-ink active:scale-95"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 animate-live-dot rounded-full bg-live ring-2 ring-surface" />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <nav className="mt-4 -mx-4 flex gap-5 overflow-x-auto px-4 text-sm font-semibold text-ink-faint [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative shrink-0 pb-2 transition-colors',
                activeTab === tab && 'text-accent-gold',
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-accent-hot to-accent-gold" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="space-y-8 px-4 pt-4">
        {/* Go Live hero */}
        <button
          type="button"
          onClick={goLive}
          className="grad-brand animate-gradient-shift glow-hot-lg group relative block w-full overflow-hidden rounded-[28px] text-left transition active:scale-[0.98]"
        >
          {/* Decorative glows / orbs, layered so this reads as a rich
              "photo" hero even without an actual background image. */}
          <span className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent-gold/30 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-accent-hot2/30 blur-3xl" />
          <span className="pointer-events-none absolute right-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-black/20" />

          <div className="relative flex min-h-[184px] items-center justify-between gap-3 p-5">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                Start streaming
              </span>
              <p className="mt-3 font-display text-[26px] font-extrabold leading-tight text-white drop-shadow-sm">
                Go Live
              </p>
              <p className="font-display text-[26px] font-extrabold italic leading-tight text-white drop-shadow-sm">
                Be Yourself
              </p>
              <p className="mt-1.5 text-xs text-white/75">Share your world with Subha</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-black shadow-lg shadow-black/20 transition group-active:scale-95">
                Go Live →
              </span>
            </div>
            <span className="relative shrink-0 self-start pt-1 font-display text-sm italic leading-tight text-white/60 [writing-mode:horizontal-tb]">
              More
              <br />
              Than Live
            </span>
          </div>
        </button>

        {/* Promo carousel */}
        <BannerCarousel items={promoBanners} />

        {/* Popular Live */}
        <Section icon={<Flame className="h-4 w-4 text-accent-hot" />} title="Popular Live">
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
        <Section icon={<MapPin className="h-4 w-4 text-accent-hot" />} title="Nearby">
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
          className="text-xs font-medium text-ink-faint transition-colors hover:text-accent-gold"
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
        'group relative block w-full overflow-hidden rounded-2xl border border-border bg-surface-raised text-left shadow-panel transition duration-200 active:scale-[0.97] active:border-accent-hot/40',
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
        // No cover set for the room — fall back to the host's profile
        // photo (blurred + scaled to fill) instead of an empty tile.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={room.host.avatar}
          alt={name}
          className="absolute inset-0 h-full w-full scale-110 object-cover object-top blur-[2px] brightness-[0.65] transition duration-300 group-active:scale-115"
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-violet/40 via-surface-raised to-surface',
          )}
        >
          <Avatar name={name} size="lg" className="h-16 w-16 text-2xl opacity-90" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/25 transition-opacity group-active:from-black/95" />

      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]">
          <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-white" />
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
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-accent-cyan text-[8px] text-white">
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
            'relative overflow-hidden rounded-2xl border border-border bg-surface-raised',
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-raised/40 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-overlay text-lg">
        📡
      </span>
      <p className="text-sm font-medium text-ink-muted">No one's live right now</p>
      <p className="text-xs text-ink-faint">Be the first — tap Go Live above.</p>
    </div>
  );
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}