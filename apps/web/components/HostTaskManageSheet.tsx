"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Target, X } from "lucide-react";
import { toast } from "sonner";
import {
  hostTasksApi,
  type CreateHostTaskInput,
  type HostTaskConfig,
  type HostTaskStatus,
  type ViewerHostTask,
} from "@/lib/api/host-task";
import { HostTaskForm } from "@/components/HostTaskForm";

interface HostTaskManageSheetProps {
  roomId: string;
  task: ViewerHostTask | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Host-facing task management, opened from the "Manage" action on the task
 * card inside the live room. Creates a task when none exists, edits the
 * current one otherwise, and offers enable/disable + delete.
 */
export function HostTaskManageSheet({ roomId, task, onClose, onChanged }: HostTaskManageSheetProps) {
  const [existing, setExisting] = useState<HostTaskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const tasks = await hostTasksApi.listRoomTasks(roomId);
      setExisting(tasks.find((t) => t.status === "active") ?? null);
    } catch {
      // If the list fails (e.g. transient), fall back to the passed task.
      setExisting(task ?? null);
    } finally {
      setLoading(false);
    }
  }, [roomId, task]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (input: CreateHostTaskInput & { status?: HostTaskStatus }) => {
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        await hostTasksApi.updateTask(existing.id, input);
        toast.success("Task updated");
      } else {
        await hostTasksApi.createTask(roomId, input);
        toast.success("Task is live for viewers");
      }
      onChanged();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save task";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await hostTasksApi.setStatus(existing.id, "inactive");
      toast.success("Task disabled");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable task");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await hostTasksApi.deleteTask(existing.id);
      toast.success("Task removed");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[88svh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#1D1829] p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Target className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#F3ECE0]">
              {existing ? "Edit task" : "New task"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-[13px] text-[#9088A0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <>
            <HostTaskForm
              initial={existing ?? task}
              submitting={saving}
              submitLabel={existing ? "Save changes" : "Start task"}
              error={error}
              onCancel={onClose}
              onSubmit={handleSubmit}
            />

            {existing && (
              <div className="mt-3 flex items-center gap-2 border-t border-[#2A2238] pt-3">
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={saving}
                  className="h-10 flex-1 rounded-full border border-[#2A2238] text-[12px] font-semibold text-[#D9D2E0] transition hover:bg-white/5 disabled:opacity-50"
                >
                  Disable
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="h-10 flex-1 rounded-full border border-red-400/30 text-[12px] font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
