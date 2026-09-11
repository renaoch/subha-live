// components/LiveVideo.tsx
'use client';

import { forwardRef, useEffect, useRef } from 'react';

interface LiveVideoProps {
  isHost: boolean;
  isWaiting: boolean;
  isLive: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  filter?: string;
  /**
   * Audio rooms never have a camera track — there is nothing to render as
   * video, so this renders an avatar-centered "on air" stage instead of a
   * black video box. Audio itself still plays: host/speaker mics are
   * routed through their own dedicated <audio> elements in useWebRTC,
   * independent of this component.
   */
  isAudioRoom?: boolean;
  hostName?: string;
  hostAvatar?: string | null;
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_35%,#3a2e5c,#1c1430_55%,#05040a)]">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10">
            {(isLive || isWaiting) && (
              <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
            )}
            {hostAvatar ? (
              <img
                src={hostAvatar}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-2 ring-white/25"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-3xl font-bold text-white ring-2 ring-white/25">
                {hostName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          <p className="text-sm font-semibold text-white/80">
            {isLive ? "Audio room live" : "Getting ready…"}
          </p>
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