"use client";

import { useEffect, useState } from "react";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";

import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import { roomTasksApi, type RoomTask } from "@/lib/api/room-tasks";

export default function AdminHostTaskPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  const [task, setTaskState] = useState<RoomTask | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [rewardCoins, setRewardCoins] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      try {
        const data = await roomsApi.list();
        if (!cancelled) {
          setRooms(data.filter((r) => r.status === "live" || r.status === "created"));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load rooms");
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    }
    loadRooms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setTaskState(null);
      setTitle("");
      setTargetValue("");
      setRewardCoins("");
      return;
    }
    let cancelled = false;
    async function loadTask() {
      setLoadingTask(true);
      try {
        const result = await roomTasksApi.getTask(selectedRoomId);
        if (!cancelled) {
          setTaskState(result);
          setTitle(result?.title ?? "");
          setTargetValue(result?.targetValue ? String(result.targetValue) : "");
          setRewardCoins(result?.rewardCoins ? String(result.rewardCoins) : "");
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load task");
        }
      } finally {
        if (!cancelled) setLoadingTask(false);
      }
    }
    loadTask();
    return () => {
      cancelled = true;
    };
  }, [selectedRoomId]);

  const hasActiveTask = task?.status === "active";

  const handleSave = async () => {
    if (!selectedRoomId) return;
    const trimmedTitle = title.trim();
    const numericTarget = Number(targetValue);
    const numericReward = rewardCoins.trim() === "" ? 0 : Number(rewardCoins);

    if (!trimmedTitle) {
      setError("Give the goal a title");
      return;
    }
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setError("Enter a target greater than 0");
      return;
    }
    if (!Number.isFinite(numericReward) || numericReward < 0) {
      setError("Reward coins must be 0 or greater");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const created = await roomTasksApi.setTask(selectedRoomId, {
        title: trimmedTitle,
        targetValue: Math.round(numericTarget),
        rewardCoins: Math.round(numericReward),
      });
      setTaskState(created);
      toast.success("Task is live for viewers");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set task");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedRoomId) return;
    setSaving(true);
    try {
      await roomTasksApi.cancelTask(selectedRoomId);
      setTaskState(null);
      setTitle("");
      setTargetValue("");
      setRewardCoins("");
      toast.success("Task ended");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Target className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-[15px] font-semibold text-[#F3ECE0]">
          Host Task — Room goal
        </h1>
      </div>

      <div className="mb-5">
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
          Room
        </label>
        {loadingRooms ? (
          <div className="flex items-center gap-2 text-[13px] text-[#9088A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rooms…
          </div>
        ) : (
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="w-full rounded-xl border border-[#2A2238] bg-[#1D1829] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] focus:border-[#CBA35C]/50 focus:outline-none"
          >
            <option value="">Select a live/waiting room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} — {r.host?.name ?? r.host?.handle ?? r.host_id} ({r.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedRoomId && (
        <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-5">
          {loadingTask ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9088A0]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
            </div>
          ) : (
            <>
              {hasActiveTask && (
                <p className="mb-3 text-[12px] text-[#9088A0]">
                  Live now — {task?.currentValue ?? 0}/{task?.targetValue ?? 0}
                  {task?.rewardCoins ? ` · +${task.rewardCoins} coins on claim` : ""}.
                  Saving below replaces it with a new goal.
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Reach 5,000 coins tonight"
                    maxLength={80}
                    className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
                    Target (coins)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="5000"
                    className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
                    Reward (coins per viewer, optional)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rewardCoins}
                    onChange={(e) => setRewardCoins(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] placeholder:text-[#5E5570] focus:border-[#CBA35C]/50 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#5E5570]">
                    Leave 0 for a progress-only goal with no per-viewer claim.
                  </p>
                </div>

                {error && <p className="text-[12px] text-red-400">{error}</p>}
              </div>

              <div className="mt-5 flex items-center gap-2">
                {hasActiveTask && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="h-11 flex-1 rounded-full border border-[#2A2238] text-[13px] font-semibold text-[#D9D2E0] transition hover:bg-white/5 disabled:opacity-50"
                  >
                    End goal
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#CBA35C] text-[13px] font-semibold text-black transition hover:bg-[#CBA35C]/90 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {hasActiveTask ? "Replace goal" : "Start goal"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
