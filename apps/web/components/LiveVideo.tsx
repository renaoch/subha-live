// components/LiveVideo.tsx
import { forwardRef } from 'react';

interface LiveVideoProps {
  isHost: boolean;
  isWaiting: boolean;
  isLive: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  filter?: string;
}

// Extend VideoHTMLAttributes to include srcObject
type VideoElementProps = React.DetailedHTMLProps<
  React.VideoHTMLAttributes<HTMLVideoElement>,
  HTMLVideoElement
> & {
  srcObject?: MediaStream | null;
};

export const LiveVideo = forwardRef<HTMLVideoElement, LiveVideoProps>(
  ({ isHost, isWaiting, isLive, localStream, remoteStream, filter = 'none' }, ref) => {
    let srcObject: MediaStream | null = null;
    if (isHost && (isWaiting || isLive)) {
      srcObject = localStream ?? null;
    } else if (isLive) {
      srcObject = remoteStream ?? null;
    }

    const videoProps: VideoElementProps = {
      autoPlay: true,
      muted: isHost,
      playsInline: true,
      className: 'absolute inset-0 h-full w-full object-cover',
      style: { filter },
      srcObject,
    };

    return <video ref={ref} {...videoProps} />;
  }
);
LiveVideo.displayName = 'LiveVideo';