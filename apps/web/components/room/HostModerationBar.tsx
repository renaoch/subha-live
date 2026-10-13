"use client";

import { useEffect, useState } from "react";
import { Ban, Loader2, MicOff, UserMinus, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { roomsApi } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

/**
 * Host-only controls shown when the host taps a viewer's comment or a speaker.
 *
 *  - Mute   : can't comment; if they're a speaker their mic is silenced too.
 *  - Remove : (speakers only) back to being a viewer, mic session closed.
 *  - Block  : out of the stream, can't rejoin, the room is hidden from them.
 */
export function HostModerationBar({
  roomId,
  targetId,
  isSpeaker,
  onDone,
}: {
  roomId: string;
  targetId: string;
  isSpeaker: boolean;
  /** Called after a block / remove so the parent can close the sheet. */
  onDone: () => void;
}) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"mute" | "kick" | "block" | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    roomsApi
      .moderationList(roomId)
      .then((list) => {
        if (!cancelled) setMuted(list.muted.some((p) => p.id === targetId));
      })
      .catch(() => {
        if (!cancelled) setMuted(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, targetId]);

  const run = async (kind: "mute" | "kick" | "block", fn: () => Promise<unknown>, ok: string, close = false) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
      toast.success(ok);
      if (close) onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
      setConfirmBlock(false);
    }
  };

  const toggleMute = () =>
    run(
      "mute",
      async () => {
        if (muted) await roomsApi.unmuteUser(roomId, targetId);
        else await roomsApi.muteUser(roomId, targetId);
        setMuted(!muted);
      },
      muted ? "Unmuted" : isSpeaker ? "Muted (chat + mic)" : "Muted",
    );

  const btn =
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-bold transition active:scale-95 disabled:opacity-50";

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#100a1e] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#F5B93F]/70">Host controls</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!!busy || muted === null}
          className={cn(btn, "border-white/10 bg-white/[0.05] text-white")}
        >
          {busy === "mute" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : muted ? (
            <Volume2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <MicOff className="h-4 w-4 text-[#F5B93F]" />
          )}
          {muted ? "Unmute" : "Mute"}
        </button>

        {isSpeaker && (
          <button
            type="button"
            onClick={() =>
              run("kick", () => roomsApi.kickSpeaker(roomId, targetId), "Removed from stage", true)
            }
            disabled={!!busy}
            className={cn(btn, "border-white/10 bg-white/[0.05] text-white")}
          >
            {busy === "kick" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4 text-orange-300" />}
            Remove
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            confirmBlock
              ? run("block", () => roomsApi.blockUser(roomId, targetId), "Blocked and removed", true)
              : setConfirmBlock(true)
          }
          disabled={!!busy}
          className={cn(
            btn,
            confirmBlock
              ? "border-red-400/50 bg-red-500/20 text-red-100"
              : "border-red-400/20 bg-red-500/[0.08] text-red-200",
          )}
        >
          {busy === "block" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          {confirmBlock ? "Tap to confirm" : "Block"}
        </button>
      </div>
      {confirmBlock && (
        <p className="mt-2 px-1 text-[11px] text-white/45">
          They&apos;ll be removed from the stream and won&apos;t be able to find or rejoin your room.
        </p>
      )}
    </div>
  );
}