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
}

export const LiveVideo = forwardRef<HTMLVideoElement, LiveVideoProps>(
  ({ isHost, isWaiting, isLive, localStream, remoteStream, filter = 'none' }, forwardedRef) => {
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