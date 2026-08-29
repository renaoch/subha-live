// components/SpeakerDock.tsx
'use client';

import { MicOff } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export interface DockSpeaker {
  userId: string;
  name: string;
  avatar?: string | null;
  speaking: boolean;
  muted?: boolean;
}

interface SpeakerDockProps {
  speakers: DockSpeaker[];
  /** Nudge the stack down when other floating UI (e.g. the stage button) is above it. */
  topOffset?: number;
}

/**
 * Floating vertical stack of speaker avatars, pinned to the right edge.
 *
 * Always mounted whenever there is at least one live speaker — independent
 * of whether the AudioStageModal sheet is open. Each circle shows the
 * speaker's avatar and animates a glowing ring while they're talking.
 */
export function SpeakerDock({ speakers, topOffset = 96 }: SpeakerDockProps) {
  if (speakers.length === 0) return null;

  return (
    <div
      className="absolute right-[13px] z-30 flex flex-col items-center gap-2.5"
      style={{ top: topOffset }}
    >
      {speakers.map((speaker) => (
        <div key={speaker.userId} className="group relative flex flex-col items-center">
          {/* Animated speaking ring */}
          <div
            className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
              speaker.speaking ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              background:
                'conic-gradient(from 0deg, #FF3B5C, #FF8A5B, #FFD36E, #FF3B5C)',
              padding: 2,
              animation: speaker.speaking ? 'speakerSpin 1.6s linear infinite' : undefined,
            }}
          >
            <div className="h-full w-full rounded-full bg-black" />
          </div>

          {/* Soft pulse glow */}
          {speaker.speaking && (
            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-[#FF3B5C]/25" />
          )}

          <Avatar
            name={speaker.name}
            src={speaker.avatar ?? undefined}
            size="sm"
            className={`relative h-10 w-10 border-2 shadow-lg transition-transform duration-150 ${
              speaker.speaking
                ? 'scale-[1.08] border-transparent'
                : 'scale-100 border-white/20'
            }`}
          />

          {speaker.muted && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-[#1a1a1e] text-white/70">
              <MicOff className="h-2.5 w-2.5" strokeWidth={2.2} />
            </span>
          )}
        </div>
      ))}

      <style jsx>{`
        @keyframes speakerSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}