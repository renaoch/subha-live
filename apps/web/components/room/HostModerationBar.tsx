"use client";

import { useState } from "react";
import { Ban, Loader2, LogOut, MessageSquareOff, MessageSquare, MicOff, Mic, UserMinus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { roomsApi } from "@/lib/api/rooms";
import { runModeration, useRoomModeration } from "@/lib/room-moderation-store";
import { cn } from "@/lib/utils";

type Busy = "mic" | "chat" | "stage" | "kick" | "block" | null;

/**
 * Moderation controls for the host / moderators, shown in a participant's
 * profile. Every action is separate:
 *
 *  - Mute mic        speakers only; silences the mic, chat untouched
 *  - Restrict chat   can't send messages; mic untouched
 *  - Remove (stage)  speakers only; back to viewer, stays in the room
 *  - Kick            leaves the room, NOT blocked (may rejoin)
 *  - Block / Unblock out of the room and can't rejoin / lifts ONLY that block
 *
 * The server re-checks permission for each call; this component only decides
 * what is worth showing. State comes from the shared moderation store, so it
 * matches the Blocked Users sheet.
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
  /** Called after an action that removes the person from the room/stage. */
  onDone: () => void;
}) {
  const { data, loaded, error, reload } = useRoomModeration(roomId);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<"kick" | "block" | null>(null);

  const blockedEntry = data.blocked.find((p) => p.id === targetId);
  const chatEntry = data.muted.find((p) => p.id === targetId);
  const micEntry = data.micMuted.find((p) => p.id === targetId);
  const isBlocked = !!blockedEntry;

  const run = async (kind: Exclude<Busy, null>, call: () => Promise<unknown>, ok: string, close = false) => {
    if (busy) return;
    setBusy(kind);
    try {
      await runModeration(roomId, call);
      toast.success(ok);
      if (close) onDone();
    } catch (e) {
      // Nothing is marked as changed on failure; the user can retry.
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const base =
    "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-[11px] font-bold leading-tight transition active:scale-95 disabled:opacity-50";
  const neutral = "border-white/10 bg-white/[0.05] text-white";
  const danger = "border-red-400/20 bg-red-500/[0.08] text-red-200";
  const spin = <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#100a1e] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F5B93F]/70">Moderation</p>
        {isBlocked && (
          <span className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-200">
            <Ban className="h-3 w-3" /> Blocked from this room
          </span>
        )}
      </div>

      {!loaded && !error ? (
        <div className="flex justify-center py-4">{spin}</div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <p className="text-[12px] text-red-300">{error}</p>
          <button type="button" onClick={() => void reload()} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
            Retry
          </button>
        </div>
      ) : isBlocked ? (
        // Blocked: the only conflicting action (Block) is replaced by Unblock.
        <div className="space-y-2">
          <button
            type="button"
            disabled={!!busy || blockedEntry?.canReverse === false}
            onClick={() => run("block", () => roomsApi.unblockUser(roomId, targetId), "Unblocked")}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F5B93F] to-[#E39B1F] text-[14px] font-extrabold text-[#2a1800] transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "block" ? spin : <ShieldCheck className="h-4 w-4" />}
            Unblock
          </button>
          {blockedEntry?.canReverse === false && (
            <p className="px-1 text-center text-[11px] text-white/45">
              Blocked by another moderator — only they or the host can unblock.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={cn("grid gap-2", isSpeaker ? "grid-cols-3" : "grid-cols-3")}>
            {isSpeaker && (
              <button
                type="button"
                disabled={!!busy || micEntry?.canReverse === false}
                onClick={() =>
                  micEntry
                    ? run("mic", () => roomsApi.unmuteMic(roomId, targetId), "Mic unmuted")
                    : run("mic", () => roomsApi.muteMic(roomId, targetId), "Mic muted")
                }
                className={cn(base, neutral)}
              >
                {busy === "mic" ? spin : micEntry ? <Mic className="h-4 w-4 text-emerald-300" /> : <MicOff className="h-4 w-4 text-[#F5B93F]" />}
                {micEntry ? "Unmute mic" : "Mute mic"}
              </button>
            )}

            <button
              type="button"
              disabled={!!busy || chatEntry?.canReverse === false}
              onClick={() =>
                chatEntry
                  ? run("chat", () => roomsApi.unmuteUser(roomId, targetId), "Chat restored")
                  : run("chat", () => roomsApi.muteUser(roomId, targetId), "Chat restricted")
              }
              className={cn(base, neutral)}
            >
              {busy === "chat" ? spin : chatEntry ? <MessageSquare className="h-4 w-4 text-emerald-300" /> : <MessageSquareOff className="h-4 w-4 text-[#F5B93F]" />}
              {chatEntry ? "Allow chat" : "Restrict chat"}
            </button>

            {isSpeaker && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run("stage", () => roomsApi.kickSpeaker(roomId, targetId), "Removed from stage", true)}
                className={cn(base, neutral)}
              >
                {busy === "stage" ? spin : <UserMinus className="h-4 w-4 text-orange-300" />}
                Remove from stage
              </button>
            )}

            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                confirm === "kick"
                  ? run("kick", () => roomsApi.kickFromRoom(roomId, targetId), "Kicked from room", true)
                  : setConfirm("kick")
              }
              className={cn(base, confirm === "kick" ? "border-red-400/50 bg-red-500/20 text-red-100" : danger)}
            >
              {busy === "kick" ? spin : <LogOut className="h-4 w-4" />}
              {confirm === "kick" ? "Tap to confirm" : "Kick"}
            </button>

            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                confirm === "block"
                  ? run("block", () => roomsApi.blockUser(roomId, targetId), "Blocked and removed", true)
                  : setConfirm("block")
              }
              className={cn(base, confirm === "block" ? "border-red-400/50 bg-red-500/20 text-red-100" : danger)}
            >
              {busy === "block" ? spin : <Ban className="h-4 w-4" />}
              {confirm === "block" ? "Tap to confirm" : "Block"}
            </button>
          </div>
          {confirm && (
            <p className="mt-2 px-1 text-[11px] text-white/45">
              {confirm === "kick"
                ? "They'll be removed from the room but can rejoin."
                : "They'll be removed and won't be able to find or rejoin your room."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
