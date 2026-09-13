// components/LiveVideo.tsx
'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';

export interface AudioSeatSpeaker {
  userId: string;
  name: string;
  avatar?: string | null;
  speaking?: boolean;
}

interface LiveVideoProps {
  isHost: boolean;
  isWaiting: boolean;
  isLive: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  filter?: string;
  /**
   * Audio rooms never have a camera track — there is nothing to render as
   * video, so this renders a full seat-grid "stage" instead of a black
   * video box: the host featured up top, then the real connected
   * speakers in a grid of open/occupied seats. Audio itself still plays:
   * host/speaker mics are routed through their own dedicated <audio>
   * elements in useWebRTC, independent of this component.
   */
  isAudioRoom?: boolean;
  hostName?: string;
  hostAvatar?: string | null;
  /** Real connected guest speakers (not the host), for the seat grid. */
  speakers?: AudioSeatSpeaker[];
  /** Total guest seats available on the stage, from room.max_guest_slots. */
  seatCount?: number;
  /** True while the host themself is talking, to ring the host avatar. */
  hostSpeaking?: boolean;
  /** Tapping an empty seat opens the request-to-speak / manage sheet. */
  onOpenSeats?: () => void;
}

export const LiveVideo = forwardRef<HTMLVideoElement, LiveVideoProps>(
  (
    {
      isHost,
      isWaiting,
      isLive,
      localStream,
      remoteStream,
      filter = 'none',
      isAudioRoom = false,
      hostName,
      hostAvatar,
      speakers = [],
      seatCount = 3,
      hostSpeaking = false,
      onOpenSeats,
    },
    forwardedRef,
  ) => {
    const innerRef = useRef<HTMLVideoElement | null>(null);

    let stream: MediaStream | null = null;
    if (isHost && (isWaiting || isLive)) {
      stream = localStream ?? null;
    } else if (isLive) {
      stream = remoteStream ?? null;
    }

    // srcObject is a DOM property, not an HTML attribute — React can't set it
    // via JSX props, so it has to be assigned imperatively on the element.
    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
    }, [stream]);

    if (isAudioRoom) {
      return (
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent-violet)/0.35),transparent_55%),radial-gradient(circle_at_10%_90%,hsl(var(--accent-cyan)/0.18),transparent_50%),linear-gradient(180deg,#241a3d,#150f28_45%,#0a0714)]">
          {/* Ambient floating glows, purely decorative */}
          <span className="pointer-events-none absolute left-[8%] top-[22%] h-24 w-24 rounded-full bg-accent-violet/25 blur-3xl animate-float-slow" />
          <span className="pointer-events-none absolute right-[10%] top-[42%] h-28 w-28 rounded-full bg-accent-cyan/15 blur-3xl animate-float-slow" style={{ animationDelay: '1.5s' }} />

          <div className="relative flex h-full flex-col items-center gap-7 px-6 pt-[104px]">
            {/* Featured host seat */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex h-[76px] w-[76px] items-center justify-center">
                {(isLive || isWaiting) && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
                )}
                <div
                  className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
                    hostSpeaking ? 'grad-brand animate-gradient-shift opacity-100' : 'opacity-0'
                  }`}
                  style={{ padding: 3 }}
                >
                  <div className="h-full w-full rounded-full bg-[#0a0714]" />
                </div>
                {hostAvatar ? (
                  <img
                    src={hostAvatar}
                    alt=""
                    className="relative h-[68px] w-[68px] rounded-full object-cover ring-2 ring-white/30"
                  />
                ) : (
                  <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white ring-2 ring-white/30">
                    {hostName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                🔥{hostName || 'Host'}🔥
              </p>
            </div>

            {/* Guest seat grid — real connected speakers + open slots */}
            <div className="grid w-full max-w-[360px] grid-cols-4 gap-x-2 gap-y-5">
              {Array.from({ length: Math.max(seatCount, speakers.length) }).map((_, index) => {
                const seat = speakers[index];
                const name = seat?.name || 'Empty';
                const speaking = !!seat?.speaking;

                return (
                  <button
                    key={seat?.userId ?? `seat-${index}`}
                    type="button"
                    onClick={onOpenSeats}
                    disabled={!onOpenSeats}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      {seat ? (
                        <>
                          {speaking && (
                            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-accent-hot/25" />
                          )}
                          <span className="avatar-ring absolute inset-0">
                            <span className="block h-full w-full rounded-full bg-[#150f28]" />
                          </span>
                          <Avatar
                            name={name}
                            src={seat.avatar ?? undefined}
                            size="sm"
                            className="relative h-[52px] w-[52px] ring-2 ring-[#150f28]"
                          />
                        </>
                      ) : (
                        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-white/20 bg-white/[0.03]">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        </div>
                      )}
                    </div>
                    <span
                      className={`max-w-[60px] truncate text-[11px] font-medium ${
                        seat ? 'text-white/85' : 'text-white/35'
                      }`}
                    >
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <video
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        autoPlay
        muted={isHost}
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter }}
      />
    );
  }
);
LiveVideo.displayName = 'LiveVideo';