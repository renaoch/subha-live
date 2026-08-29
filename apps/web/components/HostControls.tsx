// components/HostControls.tsx
import { Mic, MicOff, SlidersHorizontal, Play, Loader2, Target } from 'lucide-react';

interface HostControlsProps {
  isWaiting: boolean;
  isLive: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  onStart: () => void;
  actionLoading: boolean;
  localStreamReady: boolean;
  onOpenTask?: () => void;
  taskActive?: boolean;
}

export function HostControls({
  isWaiting,
  isLive,
  micEnabled,
  onToggleMic,
  filterOpen,
  onToggleFilter,
  onStart,
  actionLoading,
  localStreamReady,
  onOpenTask,
  taskActive,
}: HostControlsProps) {
  return (
    <div className="absolute left-1/2 bottom-[43px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 p-1.5 shadow-2xl backdrop-blur-2xl">
      <button
        type="button"
        onClick={onToggleMic}
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition ${
          micEnabled ? 'text-white hover:bg-white/10' : 'bg-white text-black'
        }`}
        aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {micEnabled ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
      </button>

      <button
        type="button"
        onClick={onToggleFilter}
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition ${
          filterOpen ? 'bg-white text-black' : 'text-white hover:bg-white/10'
        }`}
        aria-label="Open streamer filters"
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" />
      </button>

      {onOpenTask && (
        <button
          type="button"
          onClick={onOpenTask}
          className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-full transition ${
            taskActive ? 'bg-white text-black' : 'text-white hover:bg-white/10'
          }`}
          aria-label={taskActive ? 'Manage room goal' : 'Set a room goal'}
        >
          <Target className="h-[18px] w-[18px]" />
          {taskActive && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FF3B5C] ring-2 ring-black" />
          )}
        </button>
      )}

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