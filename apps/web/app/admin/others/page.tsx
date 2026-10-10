"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { liveBoxApi, type LiveBoxSettings } from "@/lib/api/live-box";

const field =
  "h-11 w-full rounded-xl border border-[#2A2238] bg-[#14101d] px-3.5 text-sm text-white focus:border-[#a65bff] focus:outline-none";

export default function AdminOthersPage() {
  const [s, setS] = useState<LiveBoxSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    liveBoxApi
      .adminGet()
      .then(setS)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load settings"));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      setS(await liveBoxApi.adminSave(s));
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-2xl border border-[#2A2238] bg-[#100c18] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-white">
          <Gift className="h-4 w-4 text-[#ff6aa5]" /> Live gift box
        </h2>
        <p className="mb-4 text-xs text-white/40">
          Viewers who keep watching a live room open a coin box every interval, up to the daily limit. It stays hidden
          until you enable it and set a reward above 0.
        </p>
        {!s ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-white">
              <input type="checkbox" checked={s.isEnabled} onChange={(e) => setS({ ...s, isEnabled: e.target.checked })} className="h-4 w-4" />
              Enabled
            </label>
            <label className="block text-xs text-white/50">
              Reward per box (coins)
              <input type="number" min={0} className={`${field} mt-1`} value={s.rewardCoins} onChange={(e) => setS({ ...s, rewardCoins: Number(e.target.value) })} />
            </label>
            <label className="block text-xs text-white/50">
              Interval between boxes (seconds, 30–3600)
              <input type="number" min={30} max={3600} className={`${field} mt-1`} value={s.intervalSeconds} onChange={(e) => setS({ ...s, intervalSeconds: Number(e.target.value) })} />
            </label>
            <label className="block text-xs text-white/50">
              Boxes per viewer per day
              <input type="number" min={1} max={100} className={`${field} mt-1`} value={s.dailyLimit} onChange={(e) => setS({ ...s, dailyLimit: Number(e.target.value) })} />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#ff4d8d] to-[#a65bff] px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
