// components/GiftPickerSheet.tsx
"use client";

import { useState } from "react";
import { Heart, Star, Crown, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { charismaApi } from "@/lib/api/charisma";

interface GiftPickerSheetProps {
  roomId: string;
  hostId: string;
  onClose: () => void;
}

const PRESET_GIFTS = [
  { name: "Heart", icon: "heart", value: 10, Icon: Heart },
  { name: "Star", icon: "star", value: 50, Icon: Star },
  { name: "Crown", icon: "crown", value: 200, Icon: Crown },
  { name: "Sparkles", icon: "sparkles", value: 500, Icon: Sparkles },
] as const;

/**
 * Minimal in-room gift picker. Sending a gift here is what actually
 * feeds the room's live goal (see RoomTaskBar) — the API bumps the
 * active task's progress by the gift's value automatically whenever
 * `streamId` matches a room with an active goal.
 */
export function GiftPickerSheet({ roomId, hostId, onClose }: GiftPickerSheetProps) {
  const [sendingValue, setSendingValue] = useState<number | null>(null);

  const handleSend = async (gift: (typeof PRESET_GIFTS)[number]) => {
    if (sendingValue !== null) return;

    setSendingValue(gift.value);
    try {
      await charismaApi.send({
        recipientId: hostId,
        giftName: gift.name,
        giftIcon: gift.icon,
        value: gift.value,
        roomId,
      });
      toast.success(`Sent a ${gift.name}!`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send gift");
    } finally {
      setSendingValue(null);
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

        <div className="grid grid-cols-4 gap-2.5">
          {PRESET_GIFTS.map((gift) => {
            const isSending = sendingValue === gift.value;
            return (
              <button
                key={gift.name}
                type="button"
                onClick={() => handleSend(gift)}
                disabled={sendingValue !== null}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3 transition hover:bg-white/10 disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <gift.Icon className="h-6 w-6 text-amber-300" />
                )}
                <span className="text-[11px] font-semibold text-white">{gift.name}</span>
                <span className="text-[10px] text-white/50">{gift.value}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
