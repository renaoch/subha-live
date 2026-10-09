'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bell,
  Crown,
  Eye,
  Flame,
  Gift,
  LayoutGrid,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Swords,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { roomsApi, type RoomRecord } from '@/lib/api/rooms';
import { useCreateRoom } from '@/hooks/queries/use-rooms';
import { useRoomEntryGuard } from '@/lib/room-session-context';
import { Avatar } from '@/components/ui/avatar';
import { HeroBannerCarousel, type HeroSlide } from '@/components/HeroBannerCarousel';
import { rewardsApi, type DailyRewardOverview } from '@/lib/api/rewards';
import { referralsApi } from '@/lib/api/referrals';
import { SubhaLogo } from '@/components/SubhaLogo'; 
import { cn } from '@/lib/utils';
import { MAX_TAGLINE_LENGTH, ROOM_CATEGORIES, getRoomCategory, type RoomCategoryId } from '@/lib/room-categories';

const TABS = ['For You', 'Following', 'Nearby', 'PK', 'New'] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, LucideIcon> = {
  'For You': LayoutGrid,
  Following: Users,
  Nearby: MapPin,
  PK: Swords,
  New: Sparkles,
};

export default function LiveFeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('For You');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamTagline, setStreamTagline] = useState('');
  const [streamCategory, setStreamCategory] = useState<RoomCategoryId>('chat');
  const [dailyReward, setDailyReward] = useState<DailyRewardOverview | null>(null);
  const [referralCoins, setReferralCoins] = useState<number | null>(null);

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

  // Real values for the secondary banner slides. Best-effort: if either call
  // fails the slide simply falls back to generic copy.
  useEffect(() => {
    let cancelled = false;
    rewardsApi
      .overview()
      .then((d) => !cancelled && setDailyReward(d))
      .catch(() => {});
    referralsApi
      .overview()
      .then((d) => !cancelled && setReferralCoins(d.rewardPerReferral))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Not memoized on purpose: `openCreateModal` calls guardCreate(), which
  // depends on live auth state, so the handler must be rebuilt every render.
  const heroSlides: HeroSlide[] = (() => {
    const todayCoins = dailyReward?.schedule.find(
      (d) => d.dayIndex === dailyReward.todayDayIndex,
    )?.rewardCoins;
    const claimed = dailyReward?.alreadyClaimedToday ?? false;

    return [
      {
        id: 'go-live',
        title: 'Go Live',
        highlight: 'Be Yourself',
        subtitle: 'Share your world with Subha',
        cta: 'Go Live',
        onClick: openCreateModal,
        image:
          'https://images.unsplash.com/photo-1591853725932-79227eb926b5?auto=format&fit=crop&w=1400&q=80',
        imagePosition: '60% 22%',
      },
      {
        id: 'daily-checkin',
        title: 'Daily Check-in',
        highlight: claimed ? 'Come Back Tomorrow' : 'Claim Your Coins',
        subtitle: todayCoins ? `Today's reward: ${todayCoins.toLocaleString()} coins` : 'Log in every day for bonus coins',
        cta: claimed ? 'View Rewards' : 'Claim Now',
        onClick: () => router.push('/rewards'),
        Icon: Sparkles,
      },
      {
        id: 'refer-earn',
        title: 'Refer & Earn',
        highlight: 'Invite Friends',
        subtitle: referralCoins ? `Earn ${referralCoins.toLocaleString()} coins per friend` : 'Earn coins when friends join',
        cta: 'Invite Now',
        onClick: () => router.push('/referrals'),
        Icon: Gift,
      },
    ];
  })();

  const byViewers = useMemo(
    () => [...rooms].sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0)),
    [rooms],
  );
  const popular = byViewers.slice(0, 4);

  const openRoom = (id: string) => enterRoom(id);
  const comingSoon = (what: string) => () => toast.info(`${what} coming soon`);

  const closeCreateModal = () => {
    if (createRoomMutation.isPending) return;
    setShowCreateModal(false);
    setStreamTitle('');
    setStreamTagline('');
    setStreamCategory('chat');
    router.replace('/home');
  };

  const startStream = async () => {
    if (!guardCreate()) return;
    try {
      const room = await createRoomMutation.mutateAsync({
        title: streamTitle.trim() || 'Live now',
        livekit_room_name: `subha-live-${crypto.randomUUID()}`,
        category: streamCategory,
        description: streamTagline.trim() || null,
        media_type: 'video',
      });
      setShowCreateModal(false);
      setStreamTitle('');
      setStreamTagline('');
      setStreamCategory('chat');
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
            <input
              type="text"
              value={streamTagline}
              onChange={(e) => setStreamTagline(e.target.value)}
              placeholder="Add a tagline (e.g. Let's talk 💕)"
              maxLength={MAX_TAGLINE_LENGTH}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-500/50"
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Category">
              {ROOM_CATEGORIES.map(({ id, label, Icon, chip, icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={streamCategory === id}
                  onClick={() => setStreamCategory(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    streamCategory === id ? chip : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', streamCategory === id && icon)} />
                  {label}
                </button>
              ))}
            </div>
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
        <nav
          aria-label="Feed filters"
          className="mt-4 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-all duration-200 active:scale-95',
                  active
                    ? 'border-orange-400 bg-orange-500/10 text-white shadow-[0_0_14px_rgba(249,115,22,0.55),inset_0_0_10px_rgba(249,115,22,0.12)]'
                    : 'border-white/20 bg-white/[0.03] text-white/70 hover:border-white/35 hover:text-white',
                )}
              >
                <Icon
                  className={cn('h-[18px] w-[18px]', active ? 'text-orange-400' : 'text-white/60')}
                  strokeWidth={2}
                />
                {tab}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="space-y-8 px-4 pt-4">
        {/* Hero banner carousel */}
        <HeroBannerCarousel slides={heroSlides} />

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

/*
 * Every dimension below is in `cqw` (1% of the card's own width), measured
 * from the design reference (290px-wide card). That makes the card scale
 * identically on any phone width instead of overflowing on narrow ones.
 */
function RoomCard({ room, onClick }: { room: RoomRecord; onClick: () => void }) {
  const name = room.host?.name ?? 'Host';
  const category = getRoomCategory(room.category);
  const CategoryIcon = category.Icon;
  // Tagline is the host's one-liner; fall back to the room title for rooms
  // created before taglines existed.
  const subtitle = room.description?.trim() || room.title || 'Live now';
  const photo = room.cover || room.host?.avatar || null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name} is live. ${subtitle}`}
      className="@container group relative block aspect-[5/4] w-full overflow-hidden rounded-[14px] border border-orange-500/45 bg-[#1a1a1a] text-left shadow-[0_6px_20px_rgba(0,0,0,0.5),0_0_14px_rgba(249,115,22,0.12)] transition duration-200 active:scale-[0.97]"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-active:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Avatar name={name} size="lg" className="h-16 w-16 text-2xl opacity-90" />
        </div>
      )}

      {/* Light top scrim for the pills, bottom scrim for the text */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

      {/* Top-left: LIVE + viewers */}
      <div className="absolute left-[3.8cqw] top-[3.8cqw] flex items-center gap-[2cqw]">
        <span className="flex h-[9.7cqw] items-center gap-[2.2cqw] rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-[3.4cqw] text-[4.6cqw] font-extrabold leading-none text-black shadow-[0_0_12px_rgba(249,115,22,0.45)]">
          <span className="h-[3.2cqw] w-[3.2cqw] animate-pulse rounded-full bg-black" />
          LIVE
        </span>
        <span className="flex h-[9.7cqw] items-center gap-[1.8cqw] rounded-full bg-black/55 px-[3cqw] text-[4.6cqw] font-semibold leading-none text-white backdrop-blur-md">
          <Eye className="h-[4.8cqw] w-[4.8cqw]" />
          {formatCount(room.viewerCount ?? 0)}
        </span>
      </div>

      {/* Bottom: host avatar + name + tagline, category chip on the right */}
      <div className="absolute inset-x-[4cqw] bottom-[3.8cqw] flex items-end justify-between gap-[2cqw]">
        <div className="flex min-w-0 items-center gap-[2.8cqw]">
          <Avatar
            name={name}
            src={room.host?.avatar ?? undefined}
            size="sm"
            className="h-[13.8cqw] w-[13.8cqw] shrink-0 border-[1.5px] border-white/70 text-[4cqw]"
          />
          <div className="min-w-0">
            <p className="truncate text-[5cqw] font-bold leading-[1.25] text-white drop-shadow">{name}</p>
            <p className="truncate text-[4.4cqw] leading-[1.25] text-white/80">{subtitle}</p>
          </div>
        </div>

        <span
          className={cn(
            'mb-[0.8cqw] flex h-[10.3cqw] shrink-0 items-center gap-[1.6cqw] rounded-full border px-[3.2cqw] text-[4.6cqw] font-semibold leading-none backdrop-blur-md',
            category.chip,
          )}
        >
          <CategoryIcon className={cn('h-[4.8cqw] w-[4.8cqw]', category.icon)} />
          {category.label}
        </span>
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
            'relative overflow-hidden rounded-[20px] border border-white/5 bg-white/5',
            tall ? 'aspect-[4/5]' : 'aspect-[5/4]',
          )}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      ))}
    </div>
  );
}
//s
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