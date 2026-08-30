// components/HostControls.tsx
import { Play, Loader2 } from 'lucide-react';

interface HostControlsProps {
  isWaiting: boolean;
  isLive: boolean;
  onStart: () => void;
  actionLoading: boolean;
  localStreamReady: boolean;
}

export function HostControls({
  isWaiting,
  isLive,
  onStart,
  actionLoading,
  localStreamReady,
}: HostControlsProps) {
  return (
    <div className="absolute left-1/2 bottom-[43px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 p-1.5 shadow-2xl backdrop-blur-2xl">
      {isWaiting && (
        <button
          type="button"
          onClick={onStart}
          disabled={actionLoading || !localStreamReady}
          className="flex h-[34px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          <span>Start Live</span>
        </button>
      )}
    </div>
  );
}