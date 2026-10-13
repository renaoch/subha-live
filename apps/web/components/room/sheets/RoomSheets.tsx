"use client";

import { useRoomModeration, runModeration } from "@/lib/room-moderation-store";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Ban, Coins, Flag, Gift, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { usersApi } from "@/lib/api/users";
import { roomsApi } from "@/lib/api/rooms";
import type { RoomChatMessage } from "@/lib/api/chat";
import { cn } from "@/lib/utils";

/** Shared bottom-sheet shell for the "More options" sub-sheets. */
function Sheet({ title, icon, onClose, children }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[78dvh] w-full max-w-[430px] flex-col rounded-t-[28px] border-t border-white/10 bg-[#120d1c]/97 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 backdrop-blur-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            {icon}
            <h3 className="text-[17px] font-bold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Block User ───────────────────────── */

interface Person { id: string; name: string; avatar: string | null; handle: string | null }

/**
 * Blocked Users management. Reads the same shared moderation state as the
 * participant profile, so Unblock here and Unblock in a profile always agree.
 */
export function BlockUserSheet({
  roomId,
  viewerIds,
  selfId,
  onOpenProfile,
  onClose,
}: {
  roomId: string;
  viewerIds: string[];
  selfId?: string | null;
  /** Open a participant's profile (identity + profile access). */
  onOpenProfile?: (userId: string) => void;
  onClose: () => void;
}) {
  const { data, loaded, error, reload } = useRoomModeration(roomId);
  const [viewers, setViewers] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const blockedIds = new Set(data.blocked.map((b) => b.id));

  // People currently in the room who can still be blocked.
  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(viewerIds)].filter((id) => id !== selfId && !blockedIds.has(id));
    (async () => {
      const rows = await Promise.all(
        ids.map((id) =>
          usersApi
            .getById(id)
            .then((u) => ({ id, name: u.name ?? "User", avatar: u.avatar ?? null, handle: u.handle ?? null }) as Person)
            .catch(() => null),
        ),
      );
      if (!cancelled) setViewers(rows.filter((r): r is Person => !!r));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIds.join(","), data.blocked.length]);

  const act = async (id: string, name: string, block: boolean) => {
    if (busy) return;
    setBusy(id);
    try {
      await runModeration(roomId, () => (block ? roomsApi.blockUser(roomId, id) : roomsApi.unblockUser(roomId, id)));
      toast.success(block ? `Blocked ${name}` : `Unblocked ${name}`);
    } catch (e) {
      // State is NOT changed on failure; the user can retry.
      toast.error(e instanceof Error ? e.message : block ? "Could not block" : "Could not unblock");
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ p, blocked, canReverse = true }: { p: Person; blocked: boolean; canReverse?: boolean }) => (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
      <button
        type="button"
        onClick={() => onOpenProfile?.(p.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar name={p.name} src={p.avatar ?? undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">{p.name}</p>
          {p.handle && <p className="truncate text-[12px] text-white/45">@{p.handle}</p>}
        </div>
      </button>
      <button
        type="button"
        disabled={busy === p.id || (blocked && !canReverse)}
        onClick={() => void act(p.id, p.name, !blocked)}
        title={blocked && !canReverse ? "Blocked by another moderator" : undefined}
        className={cn(
          "flex h-8 min-w-[76px] shrink-0 items-center justify-center rounded-full px-3 text-[12px] font-bold transition active:scale-95 disabled:opacity-50",
          blocked ? "bg-white/10 text-white" : "bg-[#ff3b5c] text-white",
        )}
      >
        {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : blocked ? "Unblock" : "Block"}
      </button>
    </li>
  );

  return (
    <Sheet title="Blocked Users" icon={<Ban className="h-5 w-5 text-[#ff6fa8]" />} onClose={onClose}>
      {!loaded && !error ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[13px] text-red-300">{error}</p>
          <button type="button" onClick={() => void reload()} className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-bold text-white">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
              Blocked ({data.blocked.length})
            </p>
            {data.blocked.length === 0 ? (
              <p className="rounded-2xl bg-white/[0.03] py-5 text-center text-[13px] text-white/45">
                You haven&apos;t blocked anyone from this room.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.blocked.map((b) => (
                  <Row
                    key={b.id}
                    p={{ id: b.id, name: b.name ?? "User", avatar: b.avatar, handle: b.handle }}
                    blocked
                    canReverse={b.canReverse !== false}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/40">In the room</p>
            {viewers.length === 0 ? (
              <p className="rounded-2xl bg-white/[0.03] py-5 text-center text-[13px] text-white/45">
                No one else is in the room right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {viewers.map((p) => (
                  <Row key={p.id} p={p} blocked={false} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Gift History ───────────────────────── */

export function GiftHistorySheet({ messages, onClose }: { messages: RoomChatMessage[]; onClose: () => void }) {
  const gifts = messages.filter((m) => m.kind === "gift" && m.gift).slice().reverse();
  return (
    <Sheet title="Gift History" icon={<Gift className="h-5 w-5 text-[#ff8fb3]" />} onClose={onClose}>
      <p className="mb-3 text-[12px] text-white/45">Gifts received in this live session.</p>
      {gifts.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-white/50">No gifts yet.</p>
      ) : (
        <ul className="space-y-2">
          {gifts.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5">
              <Avatar name={m.username} src={m.avatar ?? undefined} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{m.username}</p>
                <p className="truncate text-[12px] text-white/50">
                  sent {m.gift?.name}
                  {m.gift && m.gift.quantity > 1 ? ` ×${m.gift.quantity}` : ""}
                </p>
              </div>
              {m.gift?.coinPrice ? (
                <span className="flex items-center gap-1 rounded-full bg-[#F5B93F]/15 px-2.5 py-1 text-[12px] font-black text-[#F5B93F]">
                  <Coins className="h-3.5 w-3.5" />
                  {m.gift.coinPrice * (m.gift.quantity || 1)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Gift Earnings ───────────────────────── */

export function GiftEarningsSheet({ sessionDiamonds, giftCount, onClose }: { sessionDiamonds: number; giftCount: number; onClose: () => void }) {
  return (
    <Sheet title="Gift Earnings" icon={<Coins className="h-5 w-5 text-[#F5B93F]" />} onClose={onClose}>
      <div className="rounded-2xl bg-white/[0.05] p-4 text-center">
        <p className="text-[12px] text-white/50">This session</p>
        <p className="mt-1 text-[32px] font-black tabular-nums text-[#ffd27a]">{sessionDiamonds.toLocaleString()}</p>
        <p className="text-[12px] text-white/50">diamonds from {giftCount} gift{giftCount === 1 ? "" : "s"}</p>
      </div>
      <Link
        href="/wallet/diamonds"
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-[#2a1a00]"
        style={{ background: "linear-gradient(135deg,#ffe08a,#f5b93f)" }}
      >
        Open diamond wallet
      </Link>
    </Sheet>
  );
}

/* ───────────────────────── Coin Balance ───────────────────────── */

export function CoinBalanceSheet({ onClose }: { onClose: () => void }) {
  const [coins, setCoins] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    usersApi
      .me()
      .then((p) => !cancelled && setCoins(p.coins ?? 0))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Sheet title="Coin Balance" icon={<Coins className="h-5 w-5 text-[#F5B93F]" />} onClose={onClose}>
      <div className="rounded-2xl bg-white/[0.05] p-4 text-center">
        <p className="text-[12px] text-white/50">Your wallet</p>
        <div className="mt-1 flex h-[44px] items-center justify-center">
          {coins !== null ? (
            <p className="text-[32px] font-black tabular-nums text-[#ffd27a]">{coins.toLocaleString()}</p>
          ) : failed ? (
            <p className="text-[13px] text-white/50">Couldn&apos;t load balance</p>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-white/50" />
          )}
        </div>
        <p className="text-[12px] text-white/50">coins</p>
      </div>
      <Link
        href="/wallet"
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold text-[#2a1a00]"
        style={{ background: "linear-gradient(135deg,#ffe08a,#f5b93f)" }}
      >
        Recharge
      </Link>
    </Sheet>
  );
}

/* ───────────────────────── Report Live ───────────────────────── */

const REASONS: { id: string; label: string }[] = [
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "spam", label: "Spam or scam" },
  { id: "underage", label: "Underage user" },
  { id: "illegal", label: "Illegal activity" },
  { id: "other", label: "Something else" },
];

export function ReportLiveSheet({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await roomsApi.reportRoom(roomId, { reason, details: details.trim() || undefined });
      toast.success("Report sent. Thanks for keeping Subha safe.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet title="Report Live" icon={<Flag className="h-5 w-5 text-[#ff4d6d]" />} onClose={onClose}>
      <div className="space-y-2">
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReason(r.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold transition",
              reason === r.id ? "border-[#ff4d8d] bg-[#ff4d8d]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/80",
            )}
          >
            {r.label}
            <span className={cn("h-4 w-4 rounded-full border-2", reason === r.id ? "border-[#ff4d8d] bg-[#ff4d8d]" : "border-white/30")} />
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 500))}
        placeholder="Add details (optional)"
        rows={3}
        className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[14px] text-white placeholder:text-white/35 focus:outline-none"
      />
      <button
        type="button"
        disabled={!reason || sending}
        onClick={() => void submit()}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-[#ff3b5c] text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit report"}
      </button>
    </Sheet>
  );
}