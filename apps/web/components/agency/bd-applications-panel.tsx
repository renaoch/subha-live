"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Check,
  X,
  Loader2,
  Clock3,
  Phone,
  Target,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { bdApi, type BdApplicationAdmin } from "@/lib/api/bd";

type Filter = "pending" | "approved" | "rejected" | "all";

export function BdApplicationsPanel() {
  const [applications, setApplications] = useState<BdApplicationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const list = await bdApi.adminList();
      setApplications(list);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      const result = await bdApi.adminApprove(id);
      toast.success(`Approved — "${result.agency.name}" agency created.`, {
        description: `Code: ${result.agency.code}`,
      });
      await load();
    } catch (err: any) {
      toast.error("Could not approve", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    try {
      await bdApi.adminReject(id);
      toast.success("Application rejected.");
      await load();
    } catch (err: any) {
      toast.error("Could not reject", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setActingId(null);
    }
  };

  const filtered = applications.filter((application) =>
    filter === "all" ? true : application.status === filter,
  );

  const pendingCount = applications.filter(
    (a) => a.status === "pending",
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#F3ECE0]">
            Agency Owner Applications
          </h1>
          <p className="text-xs text-[#9088A0]">
            {pendingCount} pending review
          </p>
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-[#1D1829] text-[#9088A0] hover:text-[#F3ECE0]"
              }`}
            >
              {f}
            </button>
          ),
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#9088A0]" />
        </div>
      )}

      {!loading && loadError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-4 py-3 text-sm text-red-300/70">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-6 py-12 text-center">
          <p className="text-sm text-[#9088A0]">
            No {filter !== "all" ? filter : ""} applications.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((application) => (
          <div
            key={application.id}
            className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {application.applicant?.avatar ? (
                  <img
                    src={application.applicant.avatar}
                    alt={application.applicant.name}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A2238] text-sm font-black text-[#F3ECE0]">
                    {(application.applicant?.name ?? application.fullName)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#F3ECE0]">
                    {application.fullName}
                  </p>
                  {application.applicant?.handle && (
                    <p className="truncate text-xs text-[#9088A0]">
                      @{application.applicant.handle}
                      {application.applicant.publicId
                        ? ` · ${application.applicant.publicId}`
                        : ""}
                    </p>
                  )}
                </div>
              </div>

              <StatusPill status={application.status} />
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-[#9088A0]">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {application.contactNumber}
              </div>

              {application.monthlyTargetUsd != null && (
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 shrink-0" />
                  Target: ${application.monthlyTargetUsd.toLocaleString()}
                  /mo
                </div>
              )}

              {application.agencyExperience && (
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="leading-relaxed">
                    {application.agencyExperience}
                  </span>
                </div>
              )}

              {application.createdAt && (
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  Applied{" "}
                  {new Date(application.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>

            {application.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(application.id)}
                  disabled={actingId === application.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-400/10 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actingId === application.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(application.id)}
                  disabled={actingId === application.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-400/10 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actingId === application.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    pending: "bg-amber-400/10 text-amber-300",
    approved: "bg-emerald-400/10 text-emerald-300",
    rejected: "bg-red-400/10 text-red-300",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        map[status ?? ""] ?? "bg-[#2A2238] text-[#9088A0]"
      }`}
    >
      {status ?? "unknown"}
    </span>
  );
}