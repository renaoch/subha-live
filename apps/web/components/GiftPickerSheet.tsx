// components/GiftPickerSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { Heart, Star, Crown, Sparkles, Gift as GiftIcon, Car, Ship, Rocket, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { charismaApi } from "@/lib/api/charisma";
import { financialApi, newClientRequestId, type GiftCatalogItem } from "@/lib/api/financial";
import { GiftImage } from "@/components/GiftImage";

interface GiftPickerSheetProps {
  roomId: string;
  hostId: string;
  onClose: () => void;
  /**
   * Called right after a gift is successfully sent, before the sheet
   * closes. The room page uses this to trigger the full-screen
   * GiftSendAnimation (with sound) instead of a toast.
   */
  onSent?: (gift: GiftCatalogItem, position: number) => void;
}

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

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = async (gift: GiftCatalogItem, position: number) => {
    if (sendingGiftId !== null) return;

    setSendingGiftId(gift.id);
    try {
      await charismaApi.send({
        recipientId: hostId,
        giftId: gift.id,
        roomId,
        // Generated fresh for this tap. If the request is retried (e.g.
        // a network hiccup) the SAME id must be reused so the server can
        // recognize it as a retry rather than a second gift — this
        // single-shot flow reuses it implicitly since we don't retry here.
        clientRequestId: newClientRequestId(),
      });
      onSent?.(gift, position);
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Send a gift</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
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
          <div className="grid grid-cols-4 gap-2.5">
            {gifts.map((gift, position) => {
              const Icon = iconFor(gift.icon);
              const isSending = sendingGiftId === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleSend(gift, position)}
                  disabled={sendingGiftId !== null}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <GiftImage
                      gift={gift}
                      position={position}
                      fallbackIcon={Icon}
                      className="flex h-8 w-8 items-center justify-center"
                      imgClassName="h-8 w-8 object-contain text-amber-300"
                    />
                  )}
                  <span className="text-[11px] font-semibold text-white">{gift.name}</span>
                  <span className="text-[10px] text-white/50">{gift.coinPrice}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
