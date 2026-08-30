"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { roomsApi, type RoomRecord } from "@/lib/api/rooms";
import {
  hostTasksApi,
  type CreateHostTaskInput,
  type HostTaskStatus,
  type HostTaskWithStats,
} from "@/lib/api/host-task";
import { HostTaskForm } from "@/components/HostTaskForm";

function audienceLabel(audience: string): string {
  if (audience === "new_users") return "New users";
  if (audience === "existing_users") return "Existing users";
  return "Everyone";
}

function targetLabel(t: HostTaskWithStats): string {
  const parts: string[] = [];
  if (t.targetHours != null) parts.push(`${t.targetHours}h`);
  if (t.targetCoins != null) parts.push(`${t.targetCoins} coins`);
  return parts.join(" + ") || "—";
}

const STATUS_STYLES: Record<HostTaskStatus, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  inactive: "bg-white/10 text-white/50",
  ended: "bg-red-400/15 text-red-300",
};

export function HostTasksPanel() {
  const [tasks, setTasks] = useState<HostTaskWithStats[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<HostTaskWithStats | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, roomList] = await Promise.all([hostTasksApi.listAll(), roomsApi.list()]);
      setTasks(all);
      setRooms(roomList.filter((r) => r.status === "live" || r.status === "created"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (input: CreateHostTaskInput & { status?: HostTaskStatus }) => {
    if (!newRoomId) return setError("Choose a room");
    setSaving(true);
    setError(null);
    try {
      await hostTasksApi.createTask(newRoomId, input);
      toast.success("Task created");
      setCreating(false);
      setNewRoomId("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create task";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (input: CreateHostTaskInput & { status?: HostTaskStatus }) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await hostTasksApi.updateTask(editing.id, input);
      toast.success("Task updated");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: HostTaskWithStats) => {
    const next: HostTaskStatus = t.status === "active" ? "inactive" : "active";
    try {
      await hostTasksApi.setStatus(t.id, next);
      toast.success(next === "active" ? "Task enabled" : "Task disabled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change status");
    }
  };

  const handleDelete = async (t: HostTaskWithStats) => {
    try {
      await hostTasksApi.deleteTask(t.id);
      toast.success("Task deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete task");
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <Target className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#F3ECE0]">Host tasks</h2>
            <p className="text-[11px] text-[#9088A0]">
              Goals tied to a specific live room (stream hours, coins, viewers).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
            setError(null);
          }}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[#CBA35C] px-4 text-[12px] font-semibold text-black transition hover:bg-[#CBA35C]/90"
        >
          <Plus className="h-4 w-4" /> New task
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-[#9088A0]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
        </div>
      ) : tasks.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed border-[#2A2238] px-6 py-14 text-center">
          <p className="text-sm font-bold text-white/40">No tasks yet</p>
          <p className="mt-1 text-xs text-white/25">Create a task for a live room.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#F3ECE0]">{t.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#9088A0]">
                    {targetLabel(t)} · +{t.rewardAmount} coins · {audienceLabel(t.audience)}
                  </p>
                  <p className="mt-1 text-[10px] text-[#5E5570]">
                    {t.stats.eligibleUsers} joined · {t.stats.completedUsers} completed ·{" "}
                    {t.stats.claimedUsers} claimed
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    STATUS_STYLES[t.status]
                  }`}
                >
                  {t.status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(t);
                    setCreating(false);
                    setError(null);
                  }}
                  className="h-9 flex-1 rounded-full border border-[#2A2238] text-[12px] font-semibold text-[#D9D2E0] transition hover:bg-white/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className="h-9 flex-1 rounded-full border border-[#2A2238] text-[12px] font-semibold text-[#D9D2E0] transition hover:bg-white/5"
                >
                  {t.status === "active" ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  aria-label="Delete task"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/30 text-red-300 transition hover:bg-red-400/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <div className="mt-5 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-[#F3ECE0]">
            {editing ? "Edit task" : "New task"}
          </h2>

          {creating && (
            <div className="mb-3">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#9088A0]">
                Room
              </label>
              <select
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="w-full rounded-xl border border-[#2A2238] bg-[#17131F] px-3.5 py-2.5 text-[14px] text-[#F3ECE0] focus:border-[#CBA35C]/50 focus:outline-none"
              >
                <option value="">Select a live/waiting room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — {r.host?.name ?? r.host?.handle ?? r.host_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <HostTaskForm
            initial={editing}
            submitting={saving}
            submitLabel={editing ? "Save changes" : "Create task"}
            error={error}
            showStatus={!!editing}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
              setError(null);
            }}
            onSubmit={editing ? handleUpdate : handleCreate}
          />
        </div>
      )}
    </div>
  );
}
