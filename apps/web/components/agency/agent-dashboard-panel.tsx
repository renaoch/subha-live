"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, TrendingUp, DollarSign, UserCheck } from "lucide-react";
import { agencyApi, type AgencyHost, type AgencyAgent } from "@/lib/api/agency";

interface AgentDashboardPanelProps {
  agencyId: string;
  agentId: string; // current user's ID (the agent)
}

export function AgentDashboardPanel({ agencyId, agentId }: AgentDashboardPanelProps) {
  const [hosts, setHosts] = useState<AgencyHost[]>([]);
  const [agent, setAgent] = useState<AgencyAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [allHosts, allAgents] = await Promise.all([
        agencyApi.hosts(agencyId),
        agencyApi.agents(agencyId),
      ]);

      const assignedHosts = allHosts.filter((h) => h.agentId === agentId);
      setHosts(assignedHosts);

      const agentRecord = allAgents.find((a) => a.userId === agentId) || null;
      setAgent(agentRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [agencyId, agentId]);

  useEffect(() => {
    load();
  }, [load]);

  // Example: sum of host commissions (dummy)
  const totalEarnings = hosts.reduce((sum, h) => sum + (h.commissionRate || 0) * 100, 0);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">Agent Dashboard</p>
        <h3 className="mt-1 text-sm font-black">Your Hosts & Performance</h3>
        <p className="mt-1 text-xs text-white/25">Overview of hosts assigned to you.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
          <div className="flex items-center gap-2 text-white/30">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Assigned Hosts</span>
          </div>
          <p className="mt-1 text-xl font-black text-white">{hosts.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
          <div className="flex items-center gap-2 text-white/30">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Commission Rate</span>
          </div>
          <p className="mt-1 text-xl font-black text-white">{agent?.commissionRate ?? 0}%</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
          <div className="flex items-center gap-2 text-white/30">
            <DollarSign className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Estimated Earnings</span>
          </div>
          <p className="mt-1 text-xl font-black text-white">₹{totalEarnings.toLocaleString()}</p>
        </div>
      </div>

      {hosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-6 py-10 text-center text-xs text-white/30">
          <UserCheck className="mx-auto h-5 w-5 text-white/15" />
          <p className="mt-2">No hosts assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hosts.map((host) => (
            <div
              key={host.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 shadow-[0_10px_40px_rgba(0,0,0,.12)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {host.user?.name || "Unknown"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  @{host.user?.handle || "n/a"} · Joined {host.joinedAt ? new Date(host.joinedAt).toLocaleDateString() : "recently"}
                </p>
              </div>
              <span className="rounded-full bg-emerald-400/[0.08] px-2.5 py-1 text-[9px] font-black uppercase text-emerald-300/70">
                Active
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}