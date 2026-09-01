"use client";

import { useEffect, useState } from "react";
import { Loader2, Swords, X, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import type { PkState } from "@/lib/api/pk";
import type { usePk } from "@/hooks/usePk";

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface PkBattleSheetProps {
  open: boolean;
  onClose: () => void;
  myUserId: string | null;
  isHost: boolean;
  hostName: string;
  pk: ReturnType<typeof usePk>;
}

type HostInfo = { id: string; name: string; handle: string; avatar: string | null };

export function PkBattleSheet({ open, onClose, myUserId, isHost, hostName, pk }: PkBattleSheetProps) {
  const [liveHosts, setLiveHosts] = useState<Map<string, HostInfo>>(new Map());
  const [outgoing, setOutgoing] = useState<{ battleId: string; opponentHostId: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    roomsApi
      .list()
      .then((rooms) => {
        const map = new Map<string, HostInfo>();
        for (const r of rooms) {
          const h = r.host;
          if (h?.id) map.set(h.id, { id: h.id, name: h.name || h.handle || "Host", handle: h.handle || "", avatar: h.avatar });
        }
        setLiveHosts(map);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [open]);

  // Load live rooms for the challenge list (only while open + host).
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  useEffect(() => {
    if (!open || !isHost) return;
    roomsApi
      .list()
      .then((list) => setRooms(list.filter((r) => r.status === "live" && r.host?.id && r.host.id !== myUserId)))
      .catch(() => setRooms([]));
  }, [open, isHost, myUserId]);

  if (!open) return null;

  const nameOf = (id: string, fallback = "Host") => liveHosts.get(id)?.name ?? fallback;
  const state: PkState | null = pk.state;
  const active = !!state && state.status === "ACTIVE";
  const finished = !!state && (state.status === "FINISHED" || state.status === "FINALIZING");

  const resetAndClose = () => {
    pk.reset();
    setOutgoing(null);
    onClose();
  };

  const handleInvite = async (opponentId: string) => {
    const battle = await pk.invite(opponentId);
    if (battle) {
      setOutgoing({ battleId: battle.id, opponentHostId: opponentId });
      toast.success("Invite sent");
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[88svh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#1D1829] p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5B93F]/20 text-[#F5B93F]">
              <Swords className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#F3ECE0]">PK Battle</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active / finished battle */}
        {(active || finished) && state ? (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <BattleSide
                name={state.hostA === myUserId ? `${hostName} (you)` : nameOf(state.hostA)}
                score={state.scoreA}
                winner={finished && state.winner === "A"}
                align="left"
              />
              <span className="text-center text-[11px] font-black text-white/40">
                {active && state.endsAt != null ? formatRemaining(state.endsAt - now) : "VS"}
              </span>
              <BattleSide
                name={state.hostB === myUserId ? `${nameOf(state.hostB)} (you)` : nameOf(state.hostB)}
                score={state.scoreB}
                winner={finished && state.winner === "B"}
                align="right"
              />
            </div>

            {finished && (
              <div className="rounded-2xl border border-[#F5B93F]/25 bg-[#F5B93F]/10 px-4 py-3 text-center">
                <p className="text-[14px] font-black text-[#F5B93F]">
                  {state.winner === "DRAW" ? "It's a draw!" : `${nameOf(state.winner === "A" ? state.hostA : state.hostB)} wins!`}
                </p>
              </div>
            )}

            {active && (
              <p className="text-center text-[11px] text-white/45">
                Send gifts to support your host — the server counts each gift toward their score.
              </p>
            )}

            {isHost && active && state && (
              <button
                type="button"
                onClick={() => pk.cancel(state.battleId)}
                disabled={pk.busy}
                className="h-11 w-full rounded-full border border-red-400/30 text-[13px] font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
              >
                End battle
              </button>
            )}

            <button
              type="button"
              onClick={resetAndClose}
              className="h-11 w-full rounded-full border border-[#2A2238] text-[13px] font-semibold text-[#D9D2E0] transition hover:bg-white/5"
            >
              Close
            </button>
          </div>
        ) : isHost && pk.incomingInvite ? (
          /* Incoming invite (host B) */
          <div className="space-y-4 text-center">
            <p className="text-[14px] font-semibold text-[#F3ECE0]">
              {nameOf(pk.incomingInvite.fromHostId)} challenges you
            </p>
            <p className="text-[12px] text-white/45">Accept to battle for 3 minutes</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pk.decline(pk.incomingInvite!.battleId)}
                disabled={pk.busy}
                className="h-11 flex-1 rounded-full border border-[#2A2238] text-[13px] font-semibold text-[#D9D2E0] transition hover:bg-white/5 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => pk.accept(pk.incomingInvite!.battleId)}
                disabled={pk.busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#F5B93F] text-[13px] font-black text-[#17131F] transition hover:brightness-110 disabled:opacity-50"
              >
                {pk.busy && <Loader2 className="h-4 w-4 animate-spin" />}Accept
              </button>
            </div>
          </div>
        ) : isHost && (outgoing || pk.acceptedInvite) ? (
          /* Waiting (host A invited / opponent accepted, or host B accepted) */
          <div className="space-y-4 text-center">
            <p className="text-[14px] font-semibold text-[#F3ECE0]">
              {outgoing
                ? `Waiting for ${nameOf(outgoing.opponentHostId)} to accept…`
                : "Opponent accepted — start when ready"}
            </p>
            {outgoing && pk.acceptedInvite ? (
              <button
                type="button"
                onClick={() => pk.start(outgoing.battleId)}
                disabled={pk.busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#F5B93F] text-[13px] font-black text-[#17131F] transition hover:brightness-110 disabled:opacity-50"
              >
                {pk.busy && <Loader2 className="h-4 w-4 animate-spin" />}Start battle
              </button>
            ) : outgoing && !pk.acceptedInvite ? (
              <p className="text-[12px] text-white/45">They'll get a push to accept. You'll start the battle.</p>
            ) : (
              <p className="text-[12px] text-white/45">Waiting for the other host to start the battle…</p>
            )}

            {outgoing && (
              <button
                type="button"
                onClick={() => pk.cancel(outgoing.battleId)}
                disabled={pk.busy}
                className="h-11 w-full rounded-full border border-red-400/30 text-[13px] font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
              >
                Cancel invite
              </button>
            )}
          </div>
        ) : isHost ? (
          /* Challenge list */
          <div className="space-y-2">
            <p className="mb-1 text-[12px] text-white/45">Choose a live host to challenge</p>
            {rooms.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-white/35">No other live hosts right now</p>
            ) : (
              rooms.map((r) => {
                const h = r.host;
                const name = h?.name || h?.handle || "Host";
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleInvite(h!.id)}
                    disabled={pk.busy}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#17131F] px-3 py-3 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5B93F]/15 text-[#F5B93F]">
                      <Crown className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-semibold text-[#F3ECE0]">{name}</p>
                      <p className="truncate text-[11px] text-white/40">{r.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-[#F5B93F]">Challenge</span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Viewer with no active PK */
          <div className="py-8 text-center">
            <p className="text-[13px] font-semibold text-[#F3ECE0]">No active PK right now</p>
            <p className="mt-1 text-[12px] text-white/40">When your host starts a battle, it'll appear here.</p>
          </div>
        )}

        {pk.error && <p className="mt-3 text-center text-[12px] text-red-400">{pk.error}</p>}
      </div>
    </div>
  );
}

function BattleSide({
  name,
  score,
  winner,
  align,
}: {
  name: string;
  score: number;
  winner: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", align === "left" ? "text-left" : "text-right")}>
      <span
        className={cn(
          "max-w-[110px] truncate text-[12px] font-semibold text-white/80",
          winner && "text-[#F5B93F]",
        )}
      >
        {name}
      </span>
      <span className={cn("text-[22px] font-black tabular-nums", winner ? "text-[#F5B93F]" : "text-white")}>
        {formatCoins(score)}
      </span>
      {winner && <span className="text-[10px] font-black uppercase tracking-wide text-[#F5B93F]">Winner</span>}
    </div>
  );
}
