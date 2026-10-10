"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Star, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import { roomTasksApi, type AdminStarTarget } from "@/lib/api/room-tasks";

const inputClass =
  "w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none";
const labelClass = "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  completed: "bg-[#CBA35C]/15 text-[#CBA35C]",
  cancelled: "bg-white/10 text-white/40",
};

function digits(v: string) {
  return v.replace(/[^0-9]/g, "");
}

/**
 * Admin → Star targets. The ONLY place a Star Target can be created or ended.
 * The in-room "Star Target" card is read-only for everyone. The API enforces
 * the same rule (profiles.is_admin) on every write, so this page being hidden
 * or bypassed does not matter for security.
 */
export default function AdminStarTargetsPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [targets, setTargets] = useState<AdminStarTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("Star Target");
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState("");

  const load = useCallback(async () => {
    try {
      const [roomList, list] = await Promise.all([roomsApi.list(), roomTasksApi.adminList()]);
      setRooms(roomList.filter((r) => r.status === "live" || r.status === "created"));
      setTargets(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load star targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  const targetNum = Number(target);
  const rewardNum = Number(reward) || 0;
  const valid = !!roomId && title.trim().length > 0 && Number.isInteger(targetNum) && targetNum > 0;

  const activeByRoom = useMemo(() => {
    const m = new Map<string, AdminStarTarget>();
    for (const t of targets) if (t.status === "active" && !m.has(t.roomId)) m.set(t.roomId, t);
    return m;
  }, [targets]);
  const replacing = roomId ? activeByRoom.get(roomId) : undefined;

  async function start() {
    if (!valid) return;
    setSaving(true);
    try {
      await roomTasksApi.setTask(roomId, { title: title.trim(), targetValue: targetNum, rewardCoins: rewardNum });
      toast.success("Star Target is live in that room");
      setTarget("");
      setReward("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set star target");
    } finally {
      setSaving(false);
    }
  }

  async function end(t: AdminStarTarget) {
    setEndingId(t.id);
    try {
      await roomTasksApi.cancelTask(t.roomId);
      toast.success("Star Target ended");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end star target");
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CBA35C]/15">
            <Star className="h-4.5 w-4.5 fill-[#CBA35C] text-[#CBA35C]" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#F3ECE0]">Set a Star Target</h2>
            <p className="text-[11px] text-[#9088A0]">
              A coin goal viewers watch fill up as gifts land. Only admins can set it — hosts and viewers just see progress.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Room</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass}>
              <option value="">Select a live / waiting room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} — {r.host?.name ?? r.host?.handle ?? r.host_id}
                  {r.status === "live" ? " · LIVE" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target (coins)</label>
              <input
                value={target}
                onChange={(e) => setTarget(digits(e.target.value))}
                inputMode="numeric"
                placeholder="20000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Reward per viewer (coins)</label>
              <input
                value={reward}
                onChange={(e) => setReward(digits(e.target.value))}
                inputMode="numeric"
                placeholder="0 = no reward"
                className={inputClass}
              />
            </div>
          </div>

          {replacing && (
            <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-[12px] text-amber-300">
              This room already has an active target ({replacing.currentValue}/{replacing.targetValue}). Starting a new one
              replaces it.
            </p>
          )}

          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => void start()}
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#CBA35C] text-[13px] font-bold text-black transition hover:bg-[#CBA35C]/90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : replacing ? "Replace target" : "Start target"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60">
        <div className="flex items-center justify-between border-b border-[#2A2238] px-4 py-3.5">
          <h2 className="text-[13px] font-semibold text-[#F3ECE0]">Recent star targets</h2>
          <span className="text-[11px] text-[#5E5570]">Updates every 10s</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-[#9088A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : targets.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm font-bold text-white/40">No star targets yet</p>
        ) : (
          <div className="divide-y divide-[#2A2238]">
            {targets.map((t) => (
              <div key={t.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[#F3ECE0]">{t.title}</p>
                    <p className="truncate text-[11px] text-[#9088A0]">
                      {t.roomTitle ?? "Room"} · {t.hostName ?? "Host"} · reward {t.rewardCoins > 0 ? `+${t.rewardCoins}` : "none"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      STATUS_STYLES[t.status] ?? "bg-white/10 text-white/50"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(t.progress, 2)}%`,
                      background: "linear-gradient(90deg,#ff4d8d,#ffb347 60%,#ffe08a)",
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#D9D2E0]">
                    {t.currentValue.toLocaleString()} / {t.targetValue.toLocaleString()} · {Math.floor(t.progress)}%
                  </span>
                  {t.status === "active" && (
                    <button
                      type="button"
                      disabled={endingId === t.id}
                      onClick={() => void end(t)}
                      className="flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {endingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
                      End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}