// File: apps/web/components/agency/agents-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { PauseCircle, Trash2, UserPlus } from "lucide-react";
import { agencyApi, type AgencyAgent } from "@/lib/api/agency";

interface AgentsPanelProps {
  agencyId: string;
}

export function AgentsPanel({ agencyId }: AgentsPanelProps) {
  const [agents, setAgents] = useState<AgencyAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAgents(await agencyApi.agents(agencyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agents.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!userId.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await agencyApi.addAgent(agencyId, userId.trim(), commissionRate ? Number(commissionRate) : undefined);
      setUserId("");
      setCommissionRate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add agent.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSuspend(agentId: string) {
    try {
      await agencyApi.suspendAgent(agencyId, agentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to suspend agent.");
    }
  }

  async function handleRemove(agentId: string) {
    try {
      await agencyApi.removeAgent(agencyId, agentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove agent.");
    }
  }

  return (
    <div className="space-y-4">
      <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">Agency team</p><h3 className="mt-1 text-sm font-black">Manage agents</h3><p className="mt-1 text-xs text-white/25">Add managers and control their commission access.</p></div>
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 shadow-[0_10px_40px_rgba(0,0,0,.12)] sm:flex-row sm:items-center"
      >
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID to add as agent"
          className="h-10 flex-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-violet-300/25"
        />
        <input
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          placeholder="Commission % (optional)"
          type="number"
          min={0}
          max={100}
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-violet-300/25 sm:w-48"
        />
        <button
          type="submit"
          disabled={submitting || !userId.trim()}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black text-black transition hover:bg-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Agent
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ) : agents.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center text-xs text-white/30">
          No agents yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 shadow-[0_10px_40px_rgba(0,0,0,.12)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{agent.name}</p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  @{agent.handle} · {agent.hostCount} host{agent.hostCount === 1 ? "" : "s"} · {agent.commissionRate}%
                  commission
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                    agent.status === "active"
                      ? "bg-emerald-400/[0.08] text-emerald-300/70"
                      : "bg-amber-400/[0.08] text-amber-300/70"
                  }`}
                >
                  {agent.status}
                </span>

                {agent.status === "active" && (
                  <button
                    type="button"
                    onClick={() => handleSuspend(agent.id)}
                    title="Suspend agent"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:bg-white/[0.06]"
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRemove(agent.id)}
                  title="Remove agent"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.05] text-red-300/60 transition hover:bg-red-400/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}