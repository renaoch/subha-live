// File: apps/web/components/agency/my-agency-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { LogOut, Users } from "lucide-react";
import type { Agency } from "@/lib/api/agency";
import { usersApi } from "@/lib/api/users";
import { formatCompact } from "@/lib/format";
import { StatTile } from "./stat-tile";
import { AgentsPanel } from "./agents-panel";
import { InvitationsPanel } from "./invitations-panel";
import { AgencyTasksPanel } from "./agency-tasks-panel";
import { PayoutsPanel } from "./payouts-panel";

interface MyAgencyPanelProps {
  agency: Agency;
  onLeave: () => void;
}

type SubTab = "overview" | "agents" | "invitations" | "tasks" | "payouts";

export function MyAgencyPanel({ agency, onLeave }: MyAgencyPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .me()
      .then((profile) => setCurrentUserId(profile.id))
      .catch(() => setCurrentUserId(null));
  }, []);

  const isOwner = currentUserId !== null && currentUserId === agency.ownerId;

  const tabs: { id: SubTab; label: string; ownerOnly?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "agents", label: "Agents", ownerOnly: true },
    { id: "invitations", label: "Invitations", ownerOnly: true },
    { id: "tasks", label: "Tasks" },
    { id: "payouts", label: "Payouts", ownerOnly: true },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile size="lg" label="Total Hosts" value={String(agency.totalHosts)} />
        <StatTile size="lg" label="Monthly Revenue" value={`\u20b9${formatCompact(agency.monthlyRevenue)}`} />
        <StatTile size="lg" label="Commission" value={`${agency.commissionRate}%`} />
      </div>

      <div className="mt-4 rounded-[28px] border border-white/[0.07] bg-[#15111B] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">Agency</p>
            <h2 className="mt-1 text-xl font-black">{agency.name}</h2>
          </div>

          <span className="rounded-full bg-[#A855F7]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#D8B4FE]">
            #{agency.code}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === tab.id ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {subTab === "overview" && (
          <>
            <div className="mt-5 h-px bg-white/[0.05]" />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3 text-xs font-bold text-white/50 transition hover:bg-white/[0.06]"
              >
                <Users className="h-3.5 w-3.5" />
                Manage Hosts
              </button>

              <button
                type="button"
                onClick={onLeave}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/10 bg-red-400/[0.05] px-5 py-3 text-xs font-bold text-red-300/60 transition hover:bg-red-400/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave Agency
              </button>
            </div>
          </>
        )}

        {subTab === "agents" && isOwner && <AgentsPanel agencyId={agency.id} />}
        {subTab === "invitations" && isOwner && <InvitationsPanel agencyId={agency.id} />}
        {subTab === "tasks" && <AgencyTasksPanel agencyId={agency.id} isOwner={isOwner} />}
        {subTab === "payouts" && isOwner && <PayoutsPanel agencyId={agency.id} />}
      </div>
    </section>
  );
}