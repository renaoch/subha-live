"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, ListChecks, Trash2, Coins, Gem, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  adminUserTasksApi,
  type AdminTaskItem,
  type AdminTaskStatus,
  type CreateAdminTaskInput,
} from "@/lib/api/admin-user-task";
import { UserTaskForm } from "@/components/admin/user-task-form";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  inactive: "bg-white/10 text-white/50",
};

const DURATION_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  one_time: "One-time",
};

export function UserTasksPanel() {
  const [tasks, setTasks] = useState<AdminTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminTaskItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminUserTasksApi.list();
      setTasks(all);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (input: CreateAdminTaskInput) => {
    setSaving(true);
    setError(null);
    try {
      await adminUserTasksApi.create(input);
      toast.success("Task created");
      setCreating(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (input: CreateAdminTaskInput) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await adminUserTasksApi.update(editing.id, input);
      toast.success("Task updated");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: AdminTaskItem) => {
    const next: AdminTaskStatus = t.status === "active" ? "inactive" : "active";
    try {
      await adminUserTasksApi.setStatus(t.id, next);
      toast.success(next === "active" ? "Task enabled" : "Task disabled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change status");
    }
  };

  const handleDelete = async (t: AdminTaskItem) => {
    try {
      await adminUserTasksApi.remove(t.id);
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
            <ListChecks className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#F3ECE0]">User tasks</h2>
            <p className="text-[11px] text-[#9088A0]">
              Platform-wide daily / weekly tasks shown on every user's task screen.
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
          <p className="text-sm font-bold text-white/40">No user tasks yet</p>
          <p className="mt-1 text-xs text-white/25">
            Create a task to show it on every user's task screen.
          </p>
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
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-[#F3ECE0]">
                      {t.title}
                    </p>
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#9088A0]">
                      {DURATION_LABELS[t.durationType] ?? t.durationType}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#9088A0]">
                    Target: {t.targetCount} · {t.targetGender === "all" ? "Everyone" : t.targetGender}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#CBA35C]">
                    {t.reward.coins > 0 && (
                      <span className="flex items-center gap-1">
                        <Coins className="h-3 w-3" /> {t.reward.coins}
                      </span>
                    )}
                    {t.reward.diamonds > 0 && (
                      <span className="flex items-center gap-1">
                        <Gem className="h-3 w-3" /> {t.reward.diamonds}
                      </span>
                    )}
                    {t.reward.exp > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> {t.reward.exp} exp
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[#5E5570]">
                    {t.stats.assignedUsers} assigned · {t.stats.completedUsers} completed ·{" "}
                    {t.stats.claimedUsers} claimed
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

          <UserTaskForm
            initial={editing}
            submitting={saving}
            submitLabel={editing ? "Save changes" : "Create task"}
            error={error}
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
