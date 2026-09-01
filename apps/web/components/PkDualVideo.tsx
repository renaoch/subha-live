"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface PkDualVideoProps {
  isHost: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  opponentStream?: MediaStream | null;
  opponentConnected?: boolean;
  filter?: string;
  primaryLabel?: string;
  opponentLabel?: string;
}

/**
 * PK dual-video view: Host A's stream and Host B's stream rendered
 * side-by-side, client-side only (no server compositing/transcoding).
 * Both streams arrive as two independent WebRTC connections; this component
 * just lays them out in a 2-column grid.
 */
export function PkDualVideo({
  isHost,
  localStream,
  remoteStream,
  opponentStream,
  opponentConnected,
  filter = "none",
  primaryLabel = "You",
  opponentLabel = "Opponent",
}: PkDualVideoProps) {
  const primaryRef = useRef<HTMLVideoElement | null>(null);
  const opponentRef = useRef<HTMLVideoElement | null>(null);

  const primaryStream: MediaStream | null = isHost ? (localStream ?? null) : (remoteStream ?? null);

  useEffect(() => {
    const el = primaryRef.current;
    if (el && el.srcObject !== primaryStream) el.srcObject = primaryStream;
  }, [primaryStream]);

  useEffect(() => {
    const el = opponentRef.current;
    if (el && el.srcObject !== opponentStream) el.srcObject = opponentStream ?? null;
  }, [opponentStream]);

  return (
    <div className="absolute inset-0 z-10 grid grid-rows-2">
      {/* Primary (self room host, or self preview) */}
      <div className="relative h-full overflow-hidden border-b border-black/40">
        <video
          ref={primaryRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter }}
        />
        <PaneLabel label={primaryLabel} />
      </div>

      {/* Opponent */}
      <div className="relative h-full overflow-hidden">
        <video
          ref={opponentRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!opponentConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting…
            </div>
          </div>
        )}
        <PaneLabel label={opponentLabel} />
      </div>
    </div>
  );
}

function PaneLabel({ label }: { label: string }) {
  return (
    <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
      {label}
    </span>
  );
}
