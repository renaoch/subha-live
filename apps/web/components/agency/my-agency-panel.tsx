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
  LayoutDashboard,
  UserCog,
  Mail,
  ListChecks,
  DollarSign,
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

import { HostsPanel } from "./hosts-panel"; // <-- NEW

import { AgentDashboardPanel } from "./agent-dashboard-panel"; // <-- NEW

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
  | "hosts"
  | "applications"
  | "invitations"
  | "tasks"
  | "payouts"
  | "agent-dashboard";

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

  const [isAgent, setIsAgent] = useState(false);

  const [
    ownerName,
    setOwnerName,
  ] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* LOAD USER + DASHBOARD + ROLE + OWNER                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profile =
          await usersApi.me();

        if (cancelled) return;

        setCurrentUserId(
          profile.id,
        );

        // Load the agency owner name.
        // This is based on agency.ownerId, so every
        // RBAC role sees the same agency owner.
        const owner =
          await usersApi.getById(
            agency.ownerId,
          );

        if (cancelled) return;

        setOwnerName(
          owner.name,
        );

        // Check if current user is an agent
        const agents =
          await agencyApi.agents(
            agency.id,
          );

        if (cancelled) return;

        const userIsAgent =
          agents.some(
            (a) =>
              a.userId ===
              profile.id,
          );

        setIsAgent(
          userIsAgent,
        );

        const dash =
          await agencyApi.dashboard(
            agency.id,
          );

        if (!cancelled) {
          setDashboard(dash);
        }
      } catch {
        // ignore
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [agency.id, agency.ownerId]);

  /* ------------------------------------------------------------------------ */
  /* OWNER                                                                    */
  /* ------------------------------------------------------------------------ */

  const isOwner =
    currentUserId !== null &&
    currentUserId ===
      agency.ownerId;

  /* ------------------------------------------------------------------------ */
  /* APPLICATIONS                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      subTab !==
        "applications" ||
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

        const mapped: Application[] =
          results.map(
            (application) => ({
              userId:
                application.userId,

              name:
                application.name,

              handle:
                application.handle,

              avatar:
                application.avatar ??
                null,

              country:
                application.country ??
                null,

              countryFlag:
                application.countryFlag ??
                null,

              level:
                application.level,

              status:
                application.status,

              createdAt:
                application.createdAt ??
                null,
            }),
          );

        setApplications(
          mapped,
        );
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
    action:
      | "approve"
      | "reject",
  ) {
    try {
      setAppBusy(userId);

      if (
        action ===
        "approve"
      ) {
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
  /* TABS – RBAC                                                              */
  /* ------------------------------------------------------------------------ */

  const tabs = [
    {
      id: "overview" as const,
      label: "Overview",
      icon: (
        <LayoutDashboard className="h-4 w-4" />
      ),
    },

    {
      id: "agents" as const,
      label: "Agents",
      icon: (
        <UserCog className="h-4 w-4" />
      ),
      owner: true,
    },

    {
      id: "hosts" as const,
      label: "Hosts",
      icon: (
        <Users className="h-4 w-4" />
      ),
      owner: true,
    },

    {
      id: "applications" as const,
      label: "Applications",
      icon: (
        <FileCheck2 className="h-4 w-4" />
      ),
      owner: true,
      badge:
        dashboard?.pendingApplications,
    },

    {
      id: "invitations" as const,
      label: "Invitations",
      icon: (
        <Mail className="h-4 w-4" />
      ),
      owner: true,
    },

    {
      id: "tasks" as const,
      label: "Tasks",
      icon: (
        <ListChecks className="h-4 w-4" />
      ),
    },

    {
      id: "payouts" as const,
      label: "Payouts",
      icon: (
        <DollarSign className="h-4 w-4" />
      ),
      owner: true,
    },

    {
      id: "agent-dashboard" as const,
      label: "My Hosts",
      icon: (
        <UserCog className="h-4 w-4" />
      ),
      agent: true,
    },
  ].filter(
    (tab) => {
      if (
        tab.owner &&
        !isOwner
      ) {
        return false;
      }

      if (
        tab.agent &&
        !isAgent
      ) {
        return false;
      }

      return true;
    },
  );

  /* ======================================================================== */
  /* RENDER                                                                   */
  /* ======================================================================== */

  return (
    <section className="mt-7 overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#110e16] shadow-[0_30px_120px_rgba(0,0,0,0.4)]">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="relative border-b border-white/[0.06] bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.10),transparent_40%),#110e16] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-400/10 text-amber-200 shadow-[0_0_40px_rgba(245,158,11,0.10)]">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                  Agency Workspace
                </span>

                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase text-emerald-300">
                  Live
                </span>

                {isOwner && (
                  <span className="flex items-center gap-1.5 rounded-full border border-violet-300/15 bg-violet-400/10 px-2.5 py-1 text-[8px] font-black uppercase text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Settings2 className="h-3 w-3" />
                    Owner
                  </span>
                )}

                {isAgent &&
                  !isOwner && (
                    <span className="flex items-center gap-1.5 rounded-full border border-violet-300/15 bg-violet-400/10 px-2.5 py-1 text-[8px] font-black uppercase text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                      <UserCog className="h-3 w-3" />
                      Agent
                    </span>
                  )}
              </div>

              <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {agency.name}
              </h2>

              <p className="mt-1 text-xs text-white/40">
                Owner:{" "}
                <span className="font-semibold text-white/70">
                  {ownerName ??
                    "Unknown"}
                </span>
              </p>

              <p className="text-xs text-white/30">
                Code:{" "}
                <span className="font-mono font-bold text-white/50">
                  {agency.code}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-2 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-4 py-2.5 text-xs font-bold text-red-300/60 transition hover:bg-red-400/[0.10] hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Leave
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TABS                                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="mt-6 flex gap-1 overflow-x-auto pb-0.5">
          {tabs.map(
            (tab) => (
              <TabButton
                key={tab.id}
                active={
                  subTab ===
                  tab.id
                }
                onClick={() =>
                  setSubTab(
                    tab.id,
                  )
                }
                icon={
                  tab.icon
                }
                badge={
                  tab.badge
                }
              >
                {tab.label}
              </TabButton>
            ),
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CONTENT                                                            */}
      {/* ------------------------------------------------------------------ */}

      <div className="p-5 transition-all duration-300 sm:p-7">
        {subTab ===
          "overview" && (
          <Overview
            agency={agency}
            dashboard={
              dashboard
            }
            isOwner={
              isOwner
            }
          />
        )}

        {subTab ===
          "agents" &&
          isOwner && (
            <AgentsPanel
              agencyId={
                agency.id
              }
            />
          )}

        {subTab ===
          "hosts" &&
          isOwner && (
            <HostsPanel
              agencyId={
                agency.id
              }
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
              agencyId={
                agency.id
              }
            />
          )}

        {subTab ===
          "tasks" && (
          <AgencyTasksPanel
            agencyId={
              agency.id
            }
            isOwner={
              isOwner
            }
          />
        )}

        {subTab ===
          "payouts" &&
          isOwner && (
            <PayoutsPanel
              agencyId={
                agency.id
              }
            />
          )}

        {subTab ===
          "agent-dashboard" &&
          isAgent &&
          !isOwner && (
            <AgentDashboardPanel
              agencyId={
                agency.id
              }
              agentId={
                currentUserId!
              }
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
  isOwner,
}: {
  agency: Agency;
  dashboard:
    | AgencyDashboard
    | null;
  isOwner: boolean;
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
    dashboard.activeTasks >
      0
      ? dashboard.activeTasks >
        5
        ? 72
        : 58
      : 0;

  const payoutProgress =
    dashboard
      ? dashboard.pendingPayouts >
        0
        ? 45
        : 100
      : 0;

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* STATS                                                            */}
      {/* ---------------------------------------------------------------- */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Monthly Revenue"
          value={`₹${formatCompact(
            agency.monthlyRevenue,
          )}`}
          detail="Total agency earnings"
          icon={
            <ArrowUpRight className="h-4 w-4" />
          }
          tone="gold"
        />

        <StatTile
          label="Active Hosts"
          value={String(
            activeHosts,
          )}
          detail={`${totalHosts} total hosts · ${activeHostRatio}% active`}
          icon={
            <Users className="h-4 w-4" />
          }
          tone="green"
        />

        <StatTile
          label="Active Tasks"
          value={String(
            dashboard?.activeTasks ??
              0,
          )}
          detail="Performance programs running"
          icon={
            <Check className="h-4 w-4" />
          }
          tone="purple"
        />

        <StatTile
          label="Pending Payouts"
          value={String(
            dashboard?.pendingPayouts ??
              0,
          )}
          detail="Awaiting processing"
          icon={
            <DollarSign className="h-4 w-4" />
          }
          tone="blue"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* HEALTH + QUICK ACTIONS                                           */}
      {/* ---------------------------------------------------------------- */}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
                Agency Health
              </p>

              <h3 className="mt-1 text-sm font-black">
                Network Snapshot
              </h3>
            </div>

            <Activity className="h-4 w-4 text-white/20" />
          </div>

          <div className="mt-5 space-y-4">
            <Progress
              label="Active Host Ratio"
              value={
                activeHostRatio
              }
            />

            <Progress
              label="Task Completion Rate"
              value={
                taskCompletion
              }
            />

            <Progress
              label="Payout Processing"
              value={
                payoutProgress
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-400/[0.08] to-amber-400/[0.04] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
            {isOwner
              ? "Owner Tools"
              : "Host Actions"}
          </p>

          <div className="mt-4 space-y-3 text-xs text-white/45">
            {isOwner ? (
              <>
                <p className="flex gap-2">
                  <Clock3 className="h-4 w-4 shrink-0 text-amber-200/60" />
                  Review pending applications to onboard new hosts.
                </p>

                <p className="flex gap-2">
                  <UserCog className="h-4 w-4 shrink-0 text-violet-200/60" />
                  Assign agents to manage host operations.
                </p>

                <p className="flex gap-2">
                  <DollarSign className="h-4 w-4 shrink-0 text-sky-200/60" />
                  Process payouts and keep finances in check.
                </p>
              </>
            ) : (
              <>
                <p className="flex gap-2">
                  <ListChecks className="h-4 w-4 shrink-0 text-emerald-200/60" />
                  Complete your assigned tasks to earn rewards.
                </p>

                <p className="flex gap-2">
                  <Users className="h-4 w-4 shrink-0 text-violet-200/60" />
                  Collaborate with your agent and fellow hosts.
                </p>

                <p className="flex gap-2">
                  <Activity className="h-4 w-4 shrink-0 text-blue-200/60" />
                  Track your performance and agency growth.
                </p>
              </>
            )}
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
        icon={
          <FileCheck2 />
        }
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
                    ?.charAt(
                      0,
                    )
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
                    @
                    {
                      application.handle
                    }
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