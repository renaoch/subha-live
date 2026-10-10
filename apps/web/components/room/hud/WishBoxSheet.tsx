"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Minus, Plus, X } from "lucide-react";
import { GiftImage } from "@/components/GiftImage";
import { financialApi, type GiftCatalogItem } from "@/lib/api/financial";
import type { RoomWishes } from "@/lib/api/wishes";

const MAX_WISHES = 5;

export function WishBoxSheet({
  data,
  isHost,
  saving,
  onClose,
  onSave,
  onSendGift,
}: {
  data: RoomWishes | null;
  isHost: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (wishes: Array<{ giftId: string; targetCount: number }>) => Promise<unknown>;
  onSendGift: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [catalog, setCatalog] = useState<GiftCatalogItem[] | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    financialApi
      .giftCatalog()
      .then((c) => !cancelled && setCatalog(c.filter((g) => g.isActive)))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [isHost]);

  const startEdit = () => {
    setDraft(Object.fromEntries((data?.wishes ?? []).map((w) => [w.giftId, w.targetCount])));
    setEditing(true);
  };
  const count = Object.keys(draft).length;
  const wishes = data?.wishes ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[78svh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[#120d1c]/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-white">Wish Box</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70">
            <X className="h-6 w-6" />
          </button>
        </div>

        {!editing && (
          <>
            {wishes.length === 0 && (
              <p className="py-6 text-center text-[13px] text-white/50">
                {isHost ? "Pick the gifts you'd love to receive." : "The host hasn't made a wish yet."}
              </p>
            )}
            <div className="space-y-2">
              {wishes.map((w, i) => {
                const pct = Math.min(100, (w.currentCount / w.targetCount) * 100);
                return (
                  <div key={w.giftId} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <GiftImage
                      gift={{ code: w.code, icon: w.icon }}
                      fallbackIcon={Gift}
                      position={i}
                      className="flex h-12 w-12 shrink-0 items-center justify-center"
                      imgClassName="h-12 w-12 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[14px] font-semibold text-white">{w.name}</span>
                        <span className="text-[13px] font-bold tabular-nums text-white">
                          {w.currentCount}/{w.targetCount}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, background: "linear-gradient(90deg,#ff4d8d,#ffb347)" }}
                        />
                      </div>
                      <span className="mt-1 block text-[11.5px] text-white/45">{w.coinPrice} coins each</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              {!isHost && wishes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSendGift();
                  }}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#ff4d8d,#ff1f5a)" }}
                >
                  <Gift className="h-5 w-5" /> Send a gift
                </button>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/20 text-[15px] font-semibold text-white"
                >
                  {wishes.length ? "Edit wishes" : "Make a wish"}
                </button>
              )}
            </div>
          </>
        )}

        {editing && (
          <>
            <p className="mb-2 text-[12.5px] text-white/50">
              Choose up to {MAX_WISHES} gifts and how many you want of each.
            </p>
            {!catalog && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-white/60" />}
            <div className="space-y-2">
              {catalog?.map((g, i) => {
                const target = draft[g.id];
                const picked = target !== undefined;
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-3 rounded-2xl p-2.5 ${picked ? "bg-[#ff2d6a]/15 ring-1 ring-[#ff5c9a]/60" : "bg-white/5"}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => {
                          const next = { ...d };
                          if (picked) delete next[g.id];
                          else if (Object.keys(next).length < MAX_WISHES) next[g.id] = 10;
                          return next;
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <GiftImage
                        gift={{ code: g.code, icon: g.icon }}
                        fallbackIcon={Gift}
                        position={i}
                        className="flex h-10 w-10 shrink-0 items-center justify-center"
                        imgClassName="h-10 w-10 object-contain"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-white">{g.name}</span>
                        <span className="block text-[11.5px] text-white/45">{g.coinPrice} coins</span>
                      </span>
                    </button>
                    {picked && (
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Fewer" onClick={() => setDraft((d) => ({ ...d, [g.id]: Math.max(1, target - 1) }))} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-[14px] font-bold tabular-nums text-white">{target}</span>
                        <button type="button" aria-label="More" onClick={() => setDraft((d) => ({ ...d, [g.id]: Math.min(999, target + 1) }))} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="h-12 rounded-full border border-white/20 px-6 text-[14px] font-semibold text-white/80">
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await onSave(Object.entries(draft).map(([giftId, targetCount]) => ({ giftId, targetCount })));
                  setEditing(false);
                }}
                className="flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#ff4d8d,#ff1f5a)" }}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : count === 0 ? "Clear wishes" : "Save wishes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
