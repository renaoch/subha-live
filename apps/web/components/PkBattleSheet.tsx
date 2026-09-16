"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Swords, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import type { PkState } from "@/lib/api/pk";
import type { usePk } from "@/hooks/usePk";
import { Avatar } from "@/components/ui/avatar";

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
  const [query, setQuery] = useState("");

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

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = (r.host?.name || "").toLowerCase();
      const handle = (r.host?.handle || "").toLowerCase();
      const title = (r.title || "").toLowerCase();
      return name.includes(q) || handle.includes(q) || title.includes(q);
    });
  }, [rooms, query]);

  if (!open) return null;

  const nameOf = (id: string, fallback = "Host") => liveHosts.get(id)?.name ?? fallback;
  const avatarOf = (id: string) => liveHosts.get(id)?.avatar ?? undefined;
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
    <div
      className="absolute inset-0 z-[70] flex items-end justify-center bg-black/70 px-4 pb-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88svh] w-full max-w-[390px] overflow-hidden overflow-y-auto rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-[#141418] to-[#0a0a0c] pb-6 shadow-[0_-8px_60px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-6 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient top glow — same treatment as the audio-stage sheet */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-40 w-[280px] -translate-x-1/2 rounded-full bg-[hsl(var(--accent-hot))]/[0.10] blur-3xl" />

        <div className="flex justify-center pt-3">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-5 pb-1 pt-4">
          <div className="mb-4 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5B93F]/15">
              <Swords className="h-2.5 w-2.5 text-[#F5B93F]" strokeWidth={2.4} />
            </span>
            <p className="text-[13px] font-bold tracking-tight text-white">PK Battle</p>
          </div>

          {/* Active / finished battle */}
          {(active || finished) && state ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <BattleSide
                  name={state.hostA === myUserId ? `${hostName} (you)` : nameOf(state.hostA)}
                  avatar={state.hostA === myUserId ? undefined : avatarOf(state.hostA)}
                  userId={state.hostA}
                  score={state.scoreA}
                  winner={finished && state.winner === "A"}
                  align="left"
                />
                <span className="text-center text-[11px] font-black text-white/40">
                  {active && state.endsAt != null ? formatRemaining(state.endsAt - now) : "VS"}
                </span>
                <BattleSide
                  name={state.hostB === myUserId ? `${nameOf(state.hostB)} (you)` : nameOf(state.hostB)}
                  avatar={state.hostB === myUserId ? undefined : avatarOf(state.hostB)}
                  userId={state.hostB}
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
                <p className="text-center text-[11px] text-white/40">
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
                className="h-11 w-full rounded-full bg-white/[0.06] text-[13px] font-semibold text-white/70 transition hover:bg-white/[0.1]"
              >
                Close
              </button>
            </div>
          ) : isHost && pk.incomingInvite ? (
            /* Incoming invite (host B) */
            <div className="space-y-4 pb-2 text-center">
              <Link href={`/user/${pk.incomingInvite.fromHostId}`} className="mx-auto block w-fit">
                <Avatar
                  name={nameOf(pk.incomingInvite.fromHostId)}
                  src={avatarOf(pk.incomingInvite.fromHostId)}
                  size="lg"
                />
              </Link>
              <p className="text-[14px] font-semibold text-white">
                {nameOf(pk.incomingInvite.fromHostId)} challenges you
              </p>
              <p className="text-[12px] text-white/40">Accept to battle for 3 minutes</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pk.decline(pk.incomingInvite!.battleId)}
                  disabled={pk.busy}
                  className="h-11 flex-1 rounded-full bg-white/[0.06] text-[13px] font-semibold text-white/70 transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => pk.accept(pk.incomingInvite!.battleId)}
                  disabled={pk.busy}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--accent-hot))] to-[#FF6B4A] text-[13px] font-black text-white shadow-[0_4px_24px_hsl(var(--shadow-color)/0.5)] transition active:scale-[0.98] disabled:opacity-50"
                >
                  {pk.busy && <Loader2 className="h-4 w-4 animate-spin" />}Accept
                </button>
              </div>
            </div>
          ) : isHost && (outgoing || pk.acceptedInvite) ? (
            /* Waiting (host A invited / opponent accepted, or host B accepted) */
            <div className="space-y-4 pb-2 text-center">
              <p className="text-[14px] font-semibold text-white">
                {outgoing
                  ? `Waiting for ${nameOf(outgoing.opponentHostId)} to accept…`
                  : "Opponent accepted — start when ready"}
              </p>
              {outgoing && pk.acceptedInvite ? (
                <button
                  type="button"
                  onClick={() => pk.start(outgoing.battleId)}
                  disabled={pk.busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--accent-hot))] to-[#FF6B4A] text-[13px] font-black text-white shadow-[0_4px_24px_hsl(var(--shadow-color)/0.5)] transition active:scale-[0.98] disabled:opacity-50"
                >
                  {pk.busy && <Loader2 className="h-4 w-4 animate-spin" />}Start battle
                </button>
              ) : outgoing && !pk.acceptedInvite ? (
                <p className="text-[12px] text-white/40">They'll get a push to accept. You'll start the battle.</p>
              ) : (
                <p className="text-[12px] text-white/40">Waiting for the other host to start the battle…</p>
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
            <div className="space-y-2 pb-2">
              <div className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search live hosts…"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>
              {filteredRooms.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-white/25">
                  {query ? "No hosts match your search" : "No other live hosts right now"}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredRooms.map((r) => {
                    const h = r.host;
                    const name = h?.name || h?.handle || "Host";
                    return (
                      <div
                        key={r.id}
                        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.04]"
                      >
                        <Link href={`/user/${h!.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                          <Avatar name={name} src={h?.avatar ?? undefined} size="sm" />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[12.5px] font-medium text-white/85">{name}</span>
                            <span className="block truncate text-[11px] text-white/30">{r.title}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleInvite(h!.id)}
                          disabled={pk.busy}
                          className="shrink-0 rounded-full bg-[#F5B93F]/15 px-3 py-1.5 text-[11px] font-bold text-[#F5B93F] transition hover:bg-[#F5B93F]/25 disabled:opacity-50"
                        >
                          Challenge
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Viewer with no active PK */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04]">
                <Swords className="h-4 w-4 text-white/20" strokeWidth={1.75} />
              </div>
              <p className="text-[13px] font-semibold text-white">No active PK right now</p>
              <p className="text-[11px] text-white/25">When your host starts a battle, it'll appear here.</p>
            </div>
          )}

          {pk.error && <p className="mt-3 text-center text-[12px] text-red-400">{pk.error}</p>}
        </div>
      </div>
    </div>
  );
}

function BattleSide({
  name,
  avatar,
  userId,
  score,
  winner,
  align,
}: {
  name: string;
  avatar?: string;
  userId?: string;
  score: number;
  winner: boolean;
  align: "left" | "right";
}) {
  const avatarEl = (
    <Avatar name={name} src={avatar} size="sm" className={cn("h-10 w-10", winner && "ring-2 ring-[#F5B93F]")} />
  );
  return (
    <div className={cn("flex flex-col items-center gap-1", align === "left" ? "text-left" : "text-right")}>
      {userId ? (
        <Link href={`/user/${userId}`} className="active:opacity-70">
          {avatarEl}
        </Link>
      ) : (
        avatarEl
      )}
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
