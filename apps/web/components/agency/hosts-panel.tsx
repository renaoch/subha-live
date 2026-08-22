"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserX, UserCog } from "lucide-react";
import { agencyApi, type AgencyHost, type AgencyAgent } from "@/lib/api/agency";

interface HostsPanelProps {
  agencyId: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-400/[0.08] text-emerald-300/70",
  pending: "bg-amber-400/[0.08] text-amber-300/70",
  suspended: "bg-amber-400/[0.08] text-amber-300/70",
  left: "bg-white/[0.05] text-white/30",
  removed: "bg-white/[0.05] text-white/30",
};

export function HostsPanel({ agencyId }: HostsPanelProps) {
  const [hosts, setHosts] = useState<AgencyHost[]>([]);
  const [agents, setAgents] = useState<AgencyAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [hostsData, agentsData] = await Promise.all([
        agencyApi.hosts(agencyId),
        agencyApi.agents(agencyId),
      ]);
      setHosts(hostsData);
      setAgents(agentsData.filter((a) => a.status === "active"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(hostId: string) {
    if (!confirm("Remove this host from the agency?")) return;
    try {
      await agencyApi.removeHost(agencyId, hostId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove host.");
    }
  }

  async function handleAssignAgent(hostId: string, agentId: string | null) {
    try {
      setAssigning(hostId);
      await agencyApi.assignHostAgent(agencyId, hostId, agentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign agent.");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">Active creators</p>
        <h3 className="mt-1 text-sm font-black">Hosts</h3>
        <p className="mt-1 text-xs text-white/25">All hosts approved in your agency.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ) : hosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center text-xs text-white/30">
          <Users className="mx-auto h-5 w-5 text-white/15" />
          <p className="mt-2">No hosts yet. Approve applications to onboard creators.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hosts.map((host) => (
            <div
              key={host.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 shadow-[0_10px_40px_rgba(0,0,0,.12)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {host.user?.name || "Unknown"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  @{host.user?.handle || "n/a"} · Joined {host.joinedAt ? new Date(host.joinedAt).toLocaleDateString() : "recently"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                    STATUS_STYLES[host.status] ?? STATUS_STYLES.approved
                  }`}
                >
                  {host.status}
                </span>

                {host.status === "approved" && (
                  <>
                    <div className="relative">
                      <select
                        value={host.agentId ?? ""}
                        onChange={(e) => handleAssignAgent(host.id, e.target.value || null)}
                        disabled={assigning === host.id}
                        className="h-8 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 text-[10px] text-white outline-none focus:border-violet-300/25 disabled:opacity-50"
                      >
                        <option value="">No agent</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                      <UserCog className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/20" />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(host.id)}
                      title="Remove host"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.05] text-red-300/60 transition hover:bg-red-400/10"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}