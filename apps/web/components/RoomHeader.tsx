// components/RoomHeader.tsx
import { Avatar } from '@/components/ui/avatar';
import { X } from 'lucide-react';

interface RoomHeaderProps {
  host?: { name?: string | null; avatar?: string | null } | null;
  viewerCount: number;
  isLive: boolean;
  onLeave: () => void;
}

export function RoomHeader({ host, viewerCount, isLive, onLeave }: RoomHeaderProps) {
  const hostName = host?.name || 'Host';
  const avatarUrl = host?.avatar || undefined;

  return (
    <div className="absolute inset-x-0 top-0 z-30 px-5 pt-10">
      <div className="flex min-h-10 items-center gap-3">
        <Avatar
          name={hostName}
          src={avatarUrl}
          size="md"
          online={isLive}
          className="h-9 w-9 shrink-0 border border-white/10"
        />

        <div className="ml-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-medium leading-tight">{hostName}</p>
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-white text-black">
              <span className="text-[8px] font-black leading-none">✓</span>
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-tight text-white/50">{viewerCount} watching</p>
        </div>

        <button
          type="button"
          onClick={onLeave}
          aria-label="Close room"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}