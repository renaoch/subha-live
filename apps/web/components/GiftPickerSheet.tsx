// components/GiftPickerSheet.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Star, Crown, Sparkles, Gift as GiftIcon, Car, Ship, Rocket, X, Loader2, Coins, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { charismaApi } from "@/lib/api/charisma";
import { financialApi, newClientRequestId, type GiftCatalogItem } from "@/lib/api/financial";
import { usersApi } from "@/lib/api/users";
import { GiftImage } from "@/components/GiftImage";

function formatCoins(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

interface GiftPickerSheetProps {
  roomId: string;
  hostId: string;
  onClose: () => void;
  /**
   * Called right after a gift is successfully sent, before the sheet
   * closes. The room page uses this to trigger the full-screen
   * GiftSendAnimation (with sound) instead of a toast.
   */
  onSent?: (gift: GiftCatalogItem, position: number, quantity: number) => void;
}

const MAX_QTY = 100;
const QUICK_QTY = [1, 5, 10, 50, 100];

// Remember the last pick so reopening the sheet continues a combo.
let lastGiftId: string | null = null;
let lastQty = 1;

// Maps gift_catalog.icon (server-side) to a lucide icon for display. Falls
// back to a generic gift icon for any catalog entry we don't recognize —
// new gifts can be added to the catalog without a frontend deploy.
const ICONS: Record<string, typeof Heart> = {
  rose: Heart,
  heart: Heart,
  star: Star,
  perfume: Sparkles,
  crown: Crown,
  sports_car: Car,
  yacht: Ship,
  rocket: Rocket,
};

function iconFor(icon: string) {
  return ICONS[icon] ?? GiftIcon;
}

/**
 * Minimal in-room gift picker. Sending a gift here is what actually
 * feeds the room's live goal (see RoomTaskBar) — the API bumps the
 * active task's progress by the gift's value automatically whenever
 * `roomId` matches a room with an active goal.
 *
 * Prices come from the server-side gift catalog (`financialApi.giftCatalog`)
 * — nothing here invents a price. Sending goes through `charismaApi.send`,
 * which performs the atomic coin-deduct/diamond-credit transaction AND
 * the room-task/host-task/PK/charisma side effects together.
 */
export function GiftPickerSheet({ roomId, hostId, onClose, onSent }: GiftPickerSheetProps) {
  const [gifts, setGifts] = useState<GiftCatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(lastGiftId);
  const [qty, setQty] = useState(lastQty);
  // Viewer's own coin balance, shown right in the gifting sheet so they
  // always know what they can afford before tapping a gift. Always
  // sourced from the server (usersApi.me()) — never computed/guessed on
  // the client, and re-fetched after every send so it's never stale.
  const [coins, setCoins] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);

  const refreshBalance = () => {
    usersApi
      .me()
      .then((user) => setCoins(user.coins ?? 0))
      .catch(() => setBalanceError(true));
  };

  useEffect(() => {
    let cancelled = false;

    financialApi
      .giftCatalog()
      .then((catalog) => {
        if (!cancelled) setGifts(catalog);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load gifts");
      });

    usersApi
      .me()
      .then((user) => {
        if (!cancelled) setCoins(user.coins ?? 0);
      })
      .catch(() => {
        if (!cancelled) setBalanceError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => gifts?.find((g) => g.id === selectedId) ?? null, [gifts, selectedId]);
  const selectedPosition = selected && gifts ? gifts.findIndex((g) => g.id === selected.id) : -1;

  // The most the viewer can send of the selected gift: capped at 100 and by
  // their balance. Display/UX only — fin_send_gift re-checks every unit.
  const maxQty = useMemo(() => {
    if (!selected) return MAX_QTY;
    if (coins === null || selected.coinPrice <= 0) return MAX_QTY;
    return Math.max(1, Math.min(MAX_QTY, Math.floor(coins / selected.coinPrice)));
  }, [selected, coins]);

  const clampQty = (n: number) => Math.min(maxQty, Math.max(1, Math.floor(n) || 1));
  const effectiveQty = clampQty(qty);
  const total = selected ? selected.coinPrice * effectiveQty : 0;
  const canAffordOne = !selected || coins === null || coins >= selected.coinPrice;

  // Pressing and holding − / + keeps stepping.
  const holdRef = useRef<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null>(null);
  const stopHold = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current as ReturnType<typeof setTimeout>);
      clearInterval(holdRef.current as ReturnType<typeof setInterval>);
      holdRef.current = null;
    }
  };
  const startHold = (delta: number) => {
    stopHold();
    setQty((q) => clampQty(q + delta));
    holdRef.current = setTimeout(() => {
      holdRef.current = setInterval(() => setQty((q) => clampQty(q + delta)), 70);
    }, 350);
  };
  useEffect(() => stopHold, []);

  // Keep the stepper valid when the selection or balance changes.
  useEffect(() => {
    setQty((q) => Math.min(maxQty, Math.max(1, q)));
  }, [maxQty]);

  const handleSend = async () => {
    if (!selected || sendingGiftId !== null || !canAffordOne) return;
    const quantity = effectiveQty;

    setSendingGiftId(selected.id);
    try {
      const result = await charismaApi.send({
        recipientId: hostId,
        giftId: selected.id,
        roomId,
        quantity,
        // Generated fresh for this tap. If the request is retried (e.g.
        // a network hiccup) the SAME id must be reused so the server can
        // recognize it as a retry rather than a second gift — this
        // single-shot flow reuses it implicitly since we don't retry here.
        clientRequestId: newClientRequestId(),
      });
      const delivered = result.quantity ?? quantity;
      if (delivered < quantity) {
        toast.info(`Sent ${delivered} of ${quantity} — you ran out of coins`);
      }
      lastGiftId = selected.id;
      lastQty = quantity;
      // Re-fetch the authoritative balance from the server rather than
      // subtracting locally — the debit already happened atomically
      // server-side inside fin_send_gift(), so this just reflects reality.
      refreshBalance();
      onSent?.(selected, selectedPosition, delivered);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to send gift";
      toast.error(message.includes("INSUFFICIENT") || message.toLowerCase().includes("insufficient")
        ? "Not enough coins for this gift"
        : message);
    } finally {
      setSendingGiftId(null);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-t-3xl border-t border-white/10 bg-[#111214] p-5 pb-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-white">Send a gift</h2>

          <div className="flex items-center gap-2">
            {/* Viewer's coin balance — always visible in the gifting
                section so they know what they can spend before picking a
                gift. Sourced from the server, not computed locally. */}
            {!balanceError && (
              <span className="flex items-center gap-1 rounded-full bg-[#F5B93F]/15 px-2.5 py-1 text-[12px] font-bold text-[#F5B93F]">
                <Coins className="h-3.5 w-3.5" />
                {coins === null ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  formatCoins(coins)
                )}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadError && (
          <p className="mb-3 text-[12px] text-red-400">{loadError}</p>
        )}

        {!gifts && !loadError && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        )}

        {gifts && (
          <div className="grid max-h-[38vh] grid-cols-4 gap-2.5 overflow-y-auto overscroll-contain pb-1 pr-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {gifts.map((gift, position) => {
              const Icon = iconFor(gift.icon);
              const isSelected = selectedId === gift.id;
              // Purely a display hint (dim it, don't block the tap) — the
              // real INSUFFICIENT_COINS check always happens server-side.
              const canAfford = coins === null || coins >= gift.coinPrice;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(gift.id);
                    lastGiftId = gift.id;
                  }}
                  disabled={sendingGiftId !== null}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition disabled:opacity-50 ${
                    isSelected
                      ? "scale-[1.03] border-[#F5B93F] bg-[#F5B93F]/10 shadow-[0_0_18px_-4px_rgba(245,185,63,0.7)]"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  } ${canAfford ? "" : "opacity-60"}`}
                >
                  <GiftImage
                    gift={gift}
                    position={position}
                    fallbackIcon={Icon}
                    className="flex h-8 w-8 items-center justify-center"
                    imgClassName="h-8 w-8 object-contain text-amber-300"
                  />
                  <span className="text-[11px] font-semibold text-white">{gift.name}</span>
                  <span
                    className={`flex items-center gap-0.5 text-[10px] ${
                      canAfford ? "text-white/50" : "text-red-400"
                    }`}
                  >
                    <Coins className="h-2.5 w-2.5" />
                    {gift.coinPrice}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quantity + send. Appears once a gift is picked. */}
        {gifts && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/5 p-1">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={!selected || effectiveQty <= 1}
                  onPointerDown={() => startHold(-1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-90 disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.6} />
                </button>
                <input
                  value={selected ? effectiveQty : 1}
                  onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/[^0-9]/g, ""))))}
                  inputMode="numeric"
                  aria-label="Quantity"
                  disabled={!selected}
                  className="h-9 w-[52px] bg-transparent text-center text-[17px] font-extrabold text-white outline-none disabled:opacity-40"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={!selected || effectiveQty >= maxQty}
                  onPointerDown={() => startHold(1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-90 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {QUICK_QTY.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!selected || n > maxQty}
                    onClick={() => setQty(clampQty(n))}
                    className={`h-8 min-w-[34px] rounded-full px-2 text-[12px] font-bold transition disabled:opacity-30 ${
                      selected && effectiveQty === n ? "bg-[#F5B93F] text-[#2a1a00]" : "bg-white/10 text-white/80"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!selected || sendingGiftId !== null || !canAffordOne}
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-neutral-950 transition active:scale-[0.98] disabled:bg-white/20 disabled:text-white/50"
            >
              {sendingGiftId !== null ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : !selected ? (
                "Pick a gift"
              ) : !canAffordOne ? (
                "Not enough coins"
              ) : (
                <>
                  Send{effectiveQty > 1 ? ` x${effectiveQty}` : ""}
                  <span className="flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[13px]">
                    <Coins className="h-3.5 w-3.5" />
                    {total.toLocaleString()}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}