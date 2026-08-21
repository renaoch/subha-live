// File: apps/web/components/agency/invitations-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Send, X } from "lucide-react";
import { agencyApi, type AgencyInvitation } from "@/lib/api/agency";

interface InvitationsPanelProps {
  agencyId: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-400/[0.08] text-amber-300/70",
  accepted: "bg-emerald-400/[0.08] text-emerald-300/70",
  rejected: "bg-red-400/[0.08] text-red-300/70",
  cancelled: "bg-white/[0.05] text-white/30",
  expired: "bg-white/[0.05] text-white/30",
};

export function InvitationsPanel({ agencyId }: InvitationsPanelProps) {
  const [invitations, setInvitations] = useState<AgencyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostId, setHostId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setInvitations(await agencyApi.invitations(agencyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invitations.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!hostId.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await agencyApi.inviteHost(agencyId, hostId.trim());
      setHostId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(invitationId: string) {
    try {
      await agencyApi.cancelInvitation(invitationId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel invitation.");
    }
  }

  return (
    <div className="mt-6">
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#15111B] p-4 sm:flex-row sm:items-center"
      >
        <input
          value={hostId}
          onChange={(e) => setHostId(e.target.value)}
          placeholder="Host user ID to invite"
          className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
        />
        <button
          type="submit"
          disabled={submitting || !hostId.trim()}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#A855F7] px-4 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Send Invite
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ) : invitations.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center text-xs text-white/30">
          <Mail className="mx-auto h-5 w-5 text-white/15" />
          <p className="mt-2">No invitations sent yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#15111B] p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{invitation.hostName}</p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  @{invitation.hostHandle} · sent {new Date(invitation.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                    STATUS_STYLES[invitation.status] ?? STATUS_STYLES.expired
                  }`}
                >
                  {invitation.status}
                </span>

                {invitation.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(invitation.id)}
                    title="Cancel invitation"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:bg-white/[0.06]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}