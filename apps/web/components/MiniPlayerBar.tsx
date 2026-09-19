"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, MicOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useRoomSession } from "@/lib/room-session-context";

/**
 * Instagram-style floating mini player. Lives in app/home/layout.tsx (not
 * the room route) so it can render while the person browses Home, Party,
 * or chats — the actual connection keeps running in RoomSessionProvider
 * regardless of which page is on screen; this is just a small window onto
 * the same live MediaStream.
 */
export function MiniPlayerBar() {
  const { activeRoomId, minimized, runtime, expand, closeRoom } = useRoomSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const visible = !!activeRoomId && minimized && !!runtime;

  // Bind whichever stream is relevant (a host previews their own outgoing
  // camera; a viewer watches the host's incoming stream) to the pill's
  // video element. Re-checked on a short interval rather than only on
  // state changes, since these are refs (not reactive state) that can be
  // populated after this component has already rendered.
  useEffect(() => {
    if (!visible || !runtime) return;
    const el = videoRef.current;
    if (!el) return;

    const bind = () => {
      const stream = runtime.isHost ? runtime.localStreamRef.current : runtime.remoteStreamRef.current;
      if (stream && el.srcObject !== stream) el.srcObject = stream;
    };
    bind();
    const id = window.setInterval(bind, 800);
    return () => window.clearInterval(id);
  }, [visible, runtime]);

  if (!visible || !runtime || !runtime.room) return null;

  const { room, isHost } = runtime;
  const title = isHost ? "You're live" : room.title || room.host?.name || "Live";

  const handleExpand = () => {
    expand();
    router.push(`/home/room/${activeRoomId}`);
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runtime.handleLeave();
    closeRoom();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="mini-player"
        drag
        dragMomentum={false}
        dragElastic={0.08}
        initial={{ opacity: 0, y: 24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={handleExpand}
        className="fixed bottom-24 right-4 z-[200] flex h-24 w-[132px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isHost}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Scrim so the label/controls stay legible over any video. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/40" />

        <div className="relative flex items-center justify-between p-1.5">
          <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
            <span className="h-1 w-1 rounded-full bg-white" />
            Live
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExpand}
              aria-label="Expand"
              className="rounded-full bg-black/50 p-1 text-white/90 backdrop-blur-sm active:scale-90"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close live"
              className="rounded-full bg-black/50 p-1 text-white/90 backdrop-blur-sm active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="relative mt-auto flex items-center gap-1.5 p-1.5">
          <Avatar name={room.host?.name} src={room.host?.avatar ?? undefined} size="sm" className="h-5 w-5 shrink-0" />
          <span className="truncate text-[10px] font-bold text-white">{title}</span>
        </div>

        {!runtime.hostMediaReady && !isHost && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <MicOff className="h-4 w-4 text-white/60" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
