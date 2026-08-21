// File: components/tasks/task-section.tsx

import type { TaskItem } from "@/lib/api/tasks";
import { TaskCard } from "./task-card";

interface TaskSectionProps {
  type: string;
  tasks: TaskItem[];
  claimingId: string | null;
  onClaim: (task: TaskItem) => void;
}

const TYPE_LABELS: Record<string, string> = {
  daily: "Daily Tasks",
  weekly: "Weekly Tasks",
};

export function TaskSection({ type, tasks, claimingId, onClaim }: TaskSectionProps) {
  const label = TYPE_LABELS[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)} Tasks`;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-black uppercase tracking-wider text-white/40">{label}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            claiming={claimingId === task.id}
            onClaim={() => onClaim(task)}
          />
        ))}
      </div>
    </section>
  );
}