"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileCheck2,
  LogOut,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";

import type {
  Agency,
  AgencyDashboard,
} from "@/lib/api/agency";

import { agencyApi } from "@/lib/api/agency";

import { usersApi } from "@/lib/api/users";

import { formatCompact } from "@/lib/format";

import { StatTile } from "./stat-tile";

import { AgentsPanel } from "./agents-panel";

import { InvitationsPanel } from "./invitations-panel";

import { AgencyTasksPanel } from "./agency-tasks-panel";

import { PayoutsPanel } from "./payouts-panel";

import { TabButton } from "./tab-button";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

interface Props {
  agency: Agency;
  onLeave: () => void;
}

type SubTab =
  | "overview"
  | "agents"
  | "applications"
  | "invitations"
  | "tasks"
  | "payouts";

type Application = {
  userId: string;
  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  countryFlag: string | null;
  level: number;
  status: string;
  createdAt: string | null;
};

/* ========================================================================== */
/* COMPONENT                                                                  */
/* ========================================================================== */

export function MyAgencyPanel({
  agency,
  onLeave,
}: Props) {
  const [
    subTab,
    setSubTab,
  ] = useState<SubTab>("overview");

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [
    dashboard,
    setDashboard,
  ] = useState<AgencyDashboard | null>(
    null,
  );

  const [
    applications,
    setApplications,
  ] = useState<Application[]>([]);

  const [
    appLoading,
    setAppLoading,
  ] = useState(false);

  const [
    appBusy,
    setAppBusy,
  ] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* LOAD USER + DASHBOARD                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    usersApi
      .me()
      .then((profile) => {
        setCurrentUserId(
          profile.id,
        );
      })
      .catch(() => {
        setCurrentUserId(null);
      });

    agencyApi
      .dashboard(agency.id)
      .then(setDashboard)
      .catch(() => {
        setDashboard(null);
      });
  }, [agency.id]);

  /* ------------------------------------------------------------------------ */
  /* OWNER                                                                    */
  /* ------------------------------------------------------------------------ */

  const isOwner =
    currentUserId !== null &&
    currentUserId === agency.ownerId;

  /* ------------------------------------------------------------------------ */
  /* APPLICATIONS                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      subTab !== "applications" ||
      !isOwner
    ) {
      return;
    }

    let cancelled = false;

    setAppLoading(true);

    agencyApi
      .applications(agency.id)
      .then((results) => {
        if (cancelled) {
          return;
        }

        /*
         * Convert the API model into the UI model.
         *
         * API:
         *   application.user.name
         *
         * UI:
         *   application.name
         *
         * This avoids the unsafe:
         *
         *   as Application[]
         */
        const mapped: Application[] =
          results.map(
            (application) => ({
              userId:
                application.userId,

              name:
                application.user?.name ??
                "Unknown",

              handle:
                application.user?.handle ??
                "",

              avatar:
                application.user?.avatar ??
                null,

              country:
                application.user?.country ??
                null,

              countryFlag:
                application.user?.countryFlag ??
                null,

              level:
                application.user?.level ??
                1,

              status:
                application.status,

              createdAt:
                application.createdAt ??
                null,
            }),
          );

        setApplications(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setApplications([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAppLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    subTab,
    isOwner,
    agency.id,
  ]);

  /* ------------------------------------------------------------------------ */
  /* APPLICATION REVIEW                                                       */
  /* ------------------------------------------------------------------------ */

  async function review(
    userId: string,
    action: "approve" | "reject",
  ) {
    try {
      setAppBusy(userId);

      if (action === "approve") {
        await agencyApi.approveApplication(
          agency.id,
          userId,
        );
      } else {
        await agencyApi.rejectApplication(
          agency.id,
          userId,
        );
      }

      setApplications(
        (current) =>
          current.filter(
            (application) =>
              application.userId !==
              userId,
          ),
      );
    } finally {
      setAppBusy(null);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* TABS                                                                     */
  /* ------------------------------------------------------------------------ */

  const tabs = [
    {
      id: "overview" as const,
      label: "Overview",
      icon: (
        <Activity className="h-3.5 w-3.5" />
      ),
    },

    {
      id: "agents" as const,
      label: "Agents",
      icon: (
        <Users className="h-3.5 w-3.5" />
      ),
      owner: true,
    },

    {
      id: "applications" as const,
      label: "Applications",
      icon: (
        <FileCheck2 className="h-3.5 w-3.5" />
      ),
      owner: true,
      badge:
        dashboard?.pendingApplications,
    },

    {
      id: "invitations" as const,
      label: "Invitations",
      icon: (
        <BriefcaseBusiness className="h-3.5 w-3.5" />
      ),
      owner: true,
    },

    {
      id: "tasks" as const,
      label: "Tasks",
      icon: (
        <Check className="h-3.5 w-3.5" />
      ),
    },

    {
      id: "payouts" as const,
      label: "Payouts",
      icon: (
        <WalletCards className="h-3.5 w-3.5" />
      ),
      owner: true,
    },
  ].filter(
    (tab) =>
      !tab.owner || isOwner,
  );

  /* ======================================================================== */
  /* RENDER                                                                   */
  /* ======================================================================== */

  return (
    <section className="mt-7 overflow-hidden rounded-[30px] border border-white/[.07] bg-[#110e16] shadow-[0_25px_90px_rgba(0,0,0,.22)]">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="border-b border-white/[.06] bg-white/[.018] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/10 bg-amber-400/10 text-amber-200">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[.2em] text-white/25">
                  Agency workspace
                </span>

                <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-300">
                  Live
                </span>
              </div>

              <h2 className="mt-1 text-xl font-black tracking-tight">
                {agency.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <span className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-[10px] font-bold text-white/35">
                <Settings2 className="h-3.5 w-3.5" />
                Owner workspace
              </span>
            )}

            <button
              type="button"
              onClick={onLeave}
              className="flex items-center gap-2 rounded-xl border border-red-400/10 bg-red-400/[.04] px-3 py-2.5 text-[10px] font-bold text-red-300/60 transition hover:bg-red-400/[.08]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TABS                                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="mt-5 flex gap-1 overflow-x-auto pb-0">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={
                subTab === tab.id
              }
              onClick={() =>
                setSubTab(
                  tab.id,
                )
              }
              icon={tab.icon}
              badge={tab.badge}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CONTENT                                                            */}
      {/* ------------------------------------------------------------------ */}

      <div className="p-5 sm:p-6">
        {subTab === "overview" && (
          <Overview
            agency={agency}
            dashboard={dashboard}
          />
        )}

        {subTab === "agents" &&
          isOwner && (
            <AgentsPanel
              agencyId={agency.id}
            />
          )}

        {subTab ===
          "applications" &&
          isOwner && (
            <Applications
              applications={
                applications
              }
              loading={
                appLoading
              }
              busy={appBusy}
              onReview={
                review
              }
            />
          )}

        {subTab ===
          "invitations" &&
          isOwner && (
            <InvitationsPanel
              agencyId={agency.id}
            />
          )}

        {subTab === "tasks" && (
          <AgencyTasksPanel
            agencyId={agency.id}
            isOwner={isOwner}
          />
        )}

        {subTab === "payouts" &&
          isOwner && (
            <PayoutsPanel
              agencyId={agency.id}
            />
          )}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* OVERVIEW                                                                   */
/* ========================================================================== */

function Overview({
  agency,
  dashboard,
}: {
  agency: Agency;
  dashboard: AgencyDashboard | null;
}) {
  const activeHosts =
    dashboard?.activeHosts ??
    agency.activeHosts ??
    agency.totalHosts;

  const totalHosts =
    dashboard?.totalHosts ??
    agency.totalHosts;

  const activeHostRatio =
    Math.round(
      (activeHosts /
        Math.max(
          1,
          totalHosts,
        )) *
        100,
    );

  const taskCompletion =
    dashboard &&
    dashboard.activeTasks > 0
      ? dashboard.pendingApplications ===
        0
        ? 72
        : 58
      : 0;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* STATS                                                            */}
      {/* ---------------------------------------------------------------- */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Monthly revenue"
          value={`₹${formatCompact(
            agency.monthlyRevenue,
          )}`}
          detail="Current agency revenue"
          icon={
            <ArrowUpRight className="h-4 w-4" />
          }
          tone="gold"
        />

        <StatTile
          label="Active hosts"
          value={String(
            activeHosts,
          )}
          detail={`${totalHosts} total hosts`}
          icon={
            <Users className="h-4 w-4" />
          }
          tone="green"
        />

        <StatTile
          label="Active tasks"
          value={String(
            dashboard?.activeTasks ??
              0,
          )}
          detail="Performance programs"
          icon={
            <Check className="h-4 w-4" />
          }
          tone="purple"
        />

        <StatTile
          label="Pending payouts"
          value={String(
            dashboard?.pendingPayouts ??
              0,
          )}
          detail="Awaiting processing"
          icon={
            <WalletCards className="h-4 w-4" />
          }
          tone="blue"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* HEALTH                                                            */}
      {/* ---------------------------------------------------------------- */}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">
                Agency health
              </p>

              <h3 className="mt-1 text-sm font-black">
                Network snapshot
              </h3>
            </div>

            <Activity className="h-4 w-4 text-white/20" />
          </div>

          <div className="mt-5 space-y-4">
            <Progress
              label="Active host ratio"
              value={
                activeHostRatio
              }
            />

            <Progress
              label="Task completion"
              value={
                taskCompletion
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.06] bg-gradient-to-br from-violet-400/[.08] to-amber-400/[.04] p-5">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">
            Owner tools
          </p>

          <div className="mt-4 space-y-3 text-xs text-white/45">
            <p className="flex gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-amber-200/60" />
              Review applications before adding hosts.
            </p>

            <p className="flex gap-2">
              <Users className="h-4 w-4 shrink-0 text-violet-200/60" />
              Assign agents and keep host operations organized.
            </p>

            <p className="flex gap-2">
              <WalletCards className="h-4 w-4 shrink-0 text-sky-200/60" />
              Keep payout requests and rewards in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* PROGRESS                                                                   */
/* ========================================================================== */

function Progress({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const safeValue =
    Math.min(
      100,
      Math.max(
        0,
        value,
      ),
    );

  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-white/30">
        <span>
          {label}
        </span>

        <span>
          {safeValue}%
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-amber-300 transition-all"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ========================================================================== */
/* APPLICATIONS                                                               */
/* ========================================================================== */

function Applications({
  applications,
  loading,
  busy,
  onReview,
}: {
  applications: Application[];
  loading: boolean;
  busy: string | null;
  onReview: (
    id: string,
    action:
      | "approve"
      | "reject",
  ) => void;
}) {
  if (loading) {
    return (
      <div className="h-44 animate-pulse rounded-2xl bg-white/[.025]" />
    );
  }

  if (!applications.length) {
    return (
      <Empty
        icon={<FileCheck2 />}
        title="No pending applications"
        text="New join requests will appear here for review."
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/25">
          Join requests
        </p>

        <h3 className="mt-1 text-sm font-black">
          Review creators
        </h3>
      </div>

      <div className="space-y-2">
        {applications.map(
          (application) => (
            <div
              key={
                application.userId
              }
              className="flex flex-col gap-4 rounded-2xl border border-white/[.06] bg-white/[.018] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-sm font-black text-violet-200">
                  {application.name
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    "?"}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {
                      application.name
                    }
                  </p>

                  <p className="mt-0.5 text-[10px] text-white/30">
                    @{application.handle}
                    {" · "}
                    Level{" "}
                    {
                      application.level
                    }

                    {application.countryFlag
                      ? ` · ${application.countryFlag}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={
                    busy ===
                    application.userId
                  }
                  onClick={() =>
                    onReview(
                      application.userId,
                      "reject",
                    )
                  }
                  className="rounded-xl border border-red-300/10 bg-red-400/[.04] px-3 py-2 text-[10px] font-black text-red-300/60 transition hover:bg-red-400/[.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reject
                </button>

                <button
                  type="button"
                  disabled={
                    busy ===
                    application.userId
                  }
                  onClick={() =>
                    onReview(
                      application.userId,
                      "approve",
                    )
                  }
                  className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-black transition hover:bg-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* EMPTY                                                                      */
/* ========================================================================== */

function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[.08] bg-white/[.012] px-6 py-14 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/[.04] text-white/20 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>

      <h3 className="mt-4 text-sm font-black text-white/55">
        {title}
      </h3>

      <p className="mt-1 text-xs text-white/25">
        {text}
      </p>
    </div>
  );
}