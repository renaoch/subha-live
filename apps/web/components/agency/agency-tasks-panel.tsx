// File: apps/web/components/agency/agency-tasks-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ListChecks, Loader2, Plus } from "lucide-react";
import { agencyApi, type AgencyTask, type AgencyTaskType } from "@/lib/api/agency";

interface AgencyTasksPanelProps {
  agencyId: string;
  isOwner: boolean;
}

const TASK_TYPES: { value: AgencyTaskType; label: string }[] = [
  { value: "stream_hours", label: "Stream Hours" },
  { value: "stream_days", label: "Stream Days" },
  { value: "gift_amount", label: "Gift Amount" },
  { value: "gift_count", label: "Gift Count" },
  { value: "viewer_count", label: "Viewer Count" },
  { value: "followers", label: "Followers" },
  { value: "live_sessions", label: "Live Sessions" },
  { value: "recruit_hosts", label: "Recruit Hosts" },
  { value: "custom", label: "Custom" },
];

export function AgencyTasksPanel({ agencyId, isOwner }: AgencyTasksPanelProps) {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<AgencyTaskType>("stream_hours");
  const [targetValue, setTargetValue] = useState("");
  const [rewardCoins, setRewardCoins] = useState("");
  const [rewardDiamonds, setRewardDiamonds] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTasks(await agencyApi.tasks(agencyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !targetValue) return;

    try {
      setSubmitting(true);
      setError(null);
      await agencyApi.createTask(agencyId, {
        title: title.trim(),
        type,
        targetValue: Number(targetValue),
        rewardCoins: rewardCoins ? Number(rewardCoins) : 0,
        rewardDiamonds: rewardDiamonds ? Number(rewardDiamonds) : 0,
      });
      setTitle("");
      setTargetValue("");
      setRewardCoins("");
      setRewardDiamonds("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(task: AgencyTask) {
    if (claimingId) return;
    try {
      setClaimingId(task.id);
      setError(null);
      await agencyApi.claimTask(agencyId, task.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim reward.");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="mt-6">
      {isOwner && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-white/60 transition hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? "Cancel" : "Create Task"}
          </button>

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="mt-3 grid gap-3 rounded-2xl border border-white/[0.07] bg-[#15111B] p-4 sm:grid-cols-2"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40 sm:col-span-2"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AgencyTaskType)}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none focus:border-[#A855F7]/40"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-[#15111B]">
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Target value"
                type="number"
                min={1}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
              />
              <input
                value={rewardCoins}
                onChange={(e) => setRewardCoins(e.target.value)}
                placeholder="Reward coins"
                type="number"
                min={0}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
              />
              <input
                value={rewardDiamonds}
                onChange={(e) => setRewardDiamonds(e.target.value)}
                placeholder="Reward diamonds"
                type="number"
                min={0}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
              />

              <button
                type="submit"
                disabled={submitting || !title.trim() || !targetValue}
                className="h-10 rounded-xl bg-[#A855F7] px-4 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center text-xs text-white/30">
          <ListChecks className="mx-auto h-5 w-5 text-white/15" />
          <p className="mt-2">No agency tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const assignment = task.assignment;
            const pct = assignment ? Math.min(100, (assignment.progress / assignment.targetValue) * 100) : 0;
            const ready = assignment?.status === "completed";
            const claimed = assignment?.status === "claimed";

            return (
              <div
                key={task.id}
                className="rounded-2xl border border-white/[0.07] bg-[#15111B] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{task.title}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/25">
                      {task.type.replace(/_/g, " ")} · target {task.targetValue}
                    </p>
                  </div>
                  {isOwner && (
                    <span className="shrink-0 text-[10px] font-bold text-white/30">
                      {task.completedCount}/{task.assignedCount} completed
                    </span>
                  )}
                </div>

                {assignment && (
                  <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: ready
                            ? "linear-gradient(90deg, #F5B93F, #FFDA9E)"
                            : "linear-gradient(90deg, #A86CFF, #57C2FF)",
                        }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/30">
                        {assignment.progress}/{assignment.targetValue} · +{task.rewardCoins} coins, +
                        {task.rewardDiamonds} diamonds
                      </span>

                      {claimed ? (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white/20">
                          <Check className="h-3 w-3" /> Claimed
                        </span>
                      ) : ready ? (
                        <button
                          type="button"
                          onClick={() => handleClaim(task)}
                          disabled={claimingId === task.id}
                          className="flex items-center gap-1.5 rounded-xl bg-[#F5B93F] px-3 py-1.5 text-[11px] font-black text-[#17131F] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                        >
                          {claimingId === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}