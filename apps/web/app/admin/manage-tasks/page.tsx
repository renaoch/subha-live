"use client";

import { useState } from "react";
import { Radio, ListChecks } from "lucide-react";

import { HostTasksPanel } from "@/components/admin/host-tasks-panel";
import { UserTasksPanel } from "@/components/admin/user-tasks-panel";

type Tab = "host" | "user";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "host", label: "Host task", icon: Radio },
  { id: "user", label: "User task", icon: ListChecks },
];

export default function AdminManageTasksPage() {
  const [tab, setTab] = useState<Tab>("host");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex gap-1 rounded-full border border-[#2A2238] bg-[#1D1829]/60 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[#CBA35C] text-black"
                  : "text-[#9088A0] hover:text-[#D9D2E0]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "host" ? <HostTasksPanel /> : <UserTasksPanel />}
    </div>
  );
}
