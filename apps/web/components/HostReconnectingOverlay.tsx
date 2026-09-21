"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface HostReconnectingOverlayProps {
  /** Epoch ms when the backend's reconnect grace period ends and the room
   * gets auto-closed if the host hasn't come back. Purely a display
   * countdown — the actual close is decided server-side (media.config.ts's
   * hostReconnectGraceMs); this just mirrors it so viewers aren't staring
   * at a silent freeze. */
  deadline: number;
}

/**
 * Shown to viewers when the host's connection drops (refresh, network
 * blip, app backgrounded). Gives them the real state — the host hasn't
 * ended the stream, they're just temporarily gone — with a live countdown
 * to when the room will actually close if they don't come back.
 */
export function HostReconnectingOverlay({ deadline }: HostReconnectingOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
  }, [deadline]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 px-10 text-center backdrop-blur-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
      </span>
      <p className="text-base font-bold text-white">Host connection lost</p>
      <p className="max-w-[240px] text-sm text-white/60">
        {secondsLeft > 0
          ? `Please wait — the host has ${secondsLeft}s to reconnect before this room closes`
          : "Closing this room…"}
      </p>
    </div>
  );
}