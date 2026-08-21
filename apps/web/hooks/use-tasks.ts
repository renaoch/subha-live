// File: hooks/use-tasks.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tasksApi, type TaskItem } from "@/lib/api/tasks";

interface Celebration {
  taskId: string;
  coins: number;
  diamonds: number;
  exp: number;
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await tasksApi.list();
      setTasks(result);
    } catch (err) {
      console.error("TASKS API ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = useCallback(
    async (task: TaskItem) => {
      if (claimingId) return;
      if (!task.progress.isCompleted || task.progress.isClaimed) return;

      try {
        setClaimingId(task.id);
        setError(null);

        const result = await tasksApi.claim(task.id);

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  progress: {
                    ...t.progress,
                    isClaimed: true,
                    claimedAt: new Date().toISOString(),
                  },
                }
              : t,
          ),
        );

        setCelebration({
          taskId: task.id,
          coins: result.reward.coins,
          diamonds: result.reward.diamonds,
          exp: result.reward.exp,
        });
      } catch (err) {
        console.error("TASK CLAIM ERROR:", err);
        setError(err instanceof Error ? err.message : "Unable to claim reward.");
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId],
  );

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  const summary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.progress.isCompleted).length;
    const claimableCount = tasks.filter(
      (t) => t.progress.isCompleted && !t.progress.isClaimed,
    ).length;
    return { total, completed, claimableCount };
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const key = task.type || "daily";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    return Array.from(groups.entries()).map(([type, items]) => ({ type, items }));
  }, [tasks]);

  return {
    groupedTasks,
    loading,
    error,
    claimingId,
    claim,
    celebration,
    dismissCelebration,
    summary,
    refresh: load,
  };
}