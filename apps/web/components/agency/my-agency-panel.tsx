"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  WalletCards,
  X,
  Send,
  Search,
} from "lucide-react";

import type { Agency, AgencyDashboard } from "@/lib/api/agency";
import { agencyApi } from "@/lib/api/agency";
import { usersApi } from "@/lib/api/users";
import { formatCompact } from "@/lib/format";

import { StatTile } from "./stat-tile";
import { AgentsPanel } from "./agents-panel";
import { InvitationsPanel } from "./invitations-panel";
import { AgencyTasksPanel } from "./agency-tasks-panel";
import { PayoutsPanel } from "./payouts-panel";

interface Props {
  agency: Agency;
  onLeave: () => void;
}

type Section =
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

const navigation: {
  id: Section;
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  owner: boolean;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    owner: false,
  },
  {
    id: "agents",
    label: "Agents",
    icon: Users,
    owner: true,
  },
  {
    id: "applications",
    label: "Applications",
    icon: FileCheck2,
    owner: true,
  },
  {
    id: "invitations",
    label: "Invitations",
    icon: Send,
    owner: true,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: Check,
    owner: false,
  },
  {
    id: "payouts",
    label: "Payouts",
    icon: WalletCards,
    owner: true,
  },
];

const sectionMeta: Record<
  Section,
  {
    title: string;
    description: string;
  }
> = {
  overview: {
    title: "Overview",
    description:
      "Monitor your agency performance, hosts, tasks and payouts.",
  },
  agents: {
    title: "Agents",
    description:
      "Manage your creators and monitor their agency performance.",
  },
  applications: {
    title: "Applications",
    description:
      "Review creators who want to join your agency.",
  },
  invitations: {
    title: "Invitations",
    description:
      "Manage invitations sent to potential creators.",
  },
  tasks: {
    title: "Tasks",
    description:
      "Manage agency tasks and creator performance programs.",
  },
  payouts: {
    title: "Payouts",
    description:
      "Track earnings, commissions and payout activity.",
  },
};

export function MyAgencyPanel({ agency, onLeave }: Props) {
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dashboard, setDashboard] =
    useState<AgencyDashboard | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appBusy, setAppBusy] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .me()
      .then((profile) => setCurrentUserId(profile.id))
      .catch(() => setCurrentUserId(null));

    agencyApi
      .dashboard(agency.id)
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, [agency.id]);

  const isOwner =
    currentUserId !== null && currentUserId === agency.ownerId;

  const pendingApplications =
    dashboard?.pendingApplications ?? applications.length;

  const visibleNavigation = useMemo(
    () =>
      navigation.filter(
        (item) => !item.owner || isOwner,
      ),
    [isOwner],
  );

  useEffect(() => {
    if (section !== "applications" || !isOwner) return;

    let cancelled = false;

    async function loadApplications() {
      try {
        setAppLoading(true);

        const result = await agencyApi.applications(
          agency.id,
        );

        if (!cancelled) {
          setApplications(result as Application[]);
        }
      } catch {
        if (!cancelled) {
          setApplications([]);
        }
      } finally {
        if (!cancelled) {
          setAppLoading(false);
        }
      }
    }

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [section, isOwner, agency.id]);

  async function reviewApplication(
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

      setApplications((current) =>
        current.filter(
          (application) =>
            application.userId !== userId,
        ),
      );

      const updatedDashboard =
        await agencyApi.dashboard(agency.id);

      setDashboard(updatedDashboard);
    } finally {
      setAppBusy(null);
    }
  }

  function navigate(next: Section) {
    setSection(next);
    setMobileOpen(false);
  }

  const activeMeta = sectionMeta[section];

  return (
    <section className="relative mt-7 overflow-hidden rounded-[30px] border border-white/[.07] bg-[#0f0c14] shadow-[0_30px_100px_rgba(0,0,0,.28)]">
      <div className="flex min-h-[720px]">

        {/* MOBILE OVERLAY */}

        {mobileOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* SIDEBAR */}

        <aside
          className={[
            "absolute inset-y-0 left-0 z-50 flex w-[250px] shrink-0 flex-col border-r border-white/[.06] bg-[#0e0b13] transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0",
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full",
          ].join(" ")}
        >
          {/* BRAND */}

          <div className="flex h-[82px] items-center justify-between border-b border-white/[.06] px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-200">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[.22em] text-white/25">
                  Agency
                </p>

                <p className="mt-0.5 max-w-[145px] truncate text-sm font-black text-white">
                  {agency.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-white/30 hover:bg-white/[.05] hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* AGENCY STATUS */}

          <div className="mx-4 mt-5 rounded-2xl border border-emerald-400/10 bg-emerald-400/[.04] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[.16em] text-white/25">
                Agency status
              </span>

              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>

            <p className="mt-2 text-xs text-white/35">
              {agency.totalHosts} creators in your network
            </p>
          </div>

          {/* NAVIGATION */}

          <nav className="mt-6 flex-1 px-3">
            <p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.2em] text-white/20">
              Workspace
            </p>

            <div className="space-y-1">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;

                const badge =
                  item.id === "applications"
                    ? pendingApplications
                    : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigate(item.id as Section)
                    }
                    className={[
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                      active
                        ? "bg-white/[.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]"
                        : "text-white/35 hover:bg-white/[.035] hover:text-white/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg transition",
                        active
                          ? "bg-violet-400/10 text-violet-200"
                          : "bg-white/[.025] text-white/25 group-hover:text-white/50",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="flex-1 text-xs font-bold">
                      {item.label}
                    </span>

                    {badge > 0 && (
                      <span className="min-w-[20px] rounded-full bg-violet-400/15 px-1.5 py-0.5 text-center text-[9px] font-black text-violet-200">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}

                    {active && (
                      <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* DISCOVER */}

            <div className="mt-7">
              <p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.2em] text-white/20">
                Network
              </p>

              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-white/35 transition hover:bg-white/[.035] hover:text-white/70"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[.025] text-white/25 group-hover:text-white/50">
                  <Search className="h-4 w-4" />
                </span>

                <span className="text-xs font-bold">
                  Discover Creators
                </span>
              </button>
            </div>
          </nav>

          {/* BOTTOM */}

          <div className="border-t border-white/[.06] p-3">
            <button
              type="button"
              onClick={onLeave}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-red-300/45 transition hover:bg-red-400/[.05] hover:text-red-300"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-400/[.04]">
                <LogOut className="h-4 w-4" />
              </span>

              <span className="text-xs font-bold">
                Leave Agency
              </span>
            </button>
          </div>
        </aside>

        {/* MAIN */}

        <div className="min-w-0 flex-1">

          {/* TOP HEADER */}

          <header className="flex min-h-[82px] items-center justify-between border-b border-white/[.06] px-5 sm:px-7">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileOpen(true)
                }
                className="rounded-xl border border-white/[.06] bg-white/[.025] p-2.5 text-white/45 hover:text-white lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/20">
                    Agency Workspace
                  </p>

                  <span className="hidden h-1 w-1 rounded-full bg-white/15 sm:block" />

                  <span className="hidden text-[9px] font-bold text-white/20 sm:block">
                    {agency.code}
                  </span>
                </div>

                <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                  {activeMeta.title}
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-white/[.06] bg-white/[.025] px-3 py-1.5 text-[9px] font-bold text-white/25">
                {agency.totalHosts} hosts
              </span>

              {isOwner && (
                <span className="rounded-full border border-amber-300/10 bg-amber-400/[.05] px-3 py-1.5 text-[9px] font-bold text-amber-200/60">
                  Owner
                </span>
              )}
            </div>
          </header>

          {/* PAGE CONTENT */}

          <main className="p-5 sm:p-7">

            <div className="mb-7">
              <h1 className="text-2xl font-black tracking-tight text-white">
                {activeMeta.title}
              </h1>

              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/30">
                {activeMeta.description}
              </p>
            </div>

            {section === "overview" && (
              <Overview
                agency={agency}
                dashboard={dashboard}
              />
            )}

            {section === "agents" && isOwner && (
              <AgentsPanel agencyId={agency.id} />
            )}

            {section === "applications" && isOwner && (
              <Applications
                applications={applications}
                loading={appLoading}
                busy={appBusy}
                onReview={reviewApplication}
              />
            )}

            {section === "invitations" && isOwner && (
              <InvitationsPanel
                agencyId={agency.id}
              />
            )}

            {section === "tasks" && (
              <AgencyTasksPanel
                agencyId={agency.id}
                isOwner={isOwner}
              />
            )}

            {section === "payouts" && isOwner && (
              <PayoutsPanel
                agencyId={agency.id}
              />
            )}
          </main>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* OVERVIEW */
/* -------------------------------------------------------------------------- */

function Overview({
  agency,
  dashboard,
}: {
  agency: Agency;
  dashboard: AgencyDashboard | null;
}) {
  const activeHosts =
    dashboard?.activeHosts ?? agency.totalHosts;

  const totalHosts =
    dashboard?.totalHosts ?? agency.totalHosts;

  const hostRatio =
    totalHosts > 0
      ? Math.round(
          (activeHosts / totalHosts) * 100,
        )
      : 0;

  const taskCompletion =
    dashboard && dashboard.activeTasks > 0
      ? dashboard.pendingApplications === 0
        ? 72
        : 58
      : 0;

  return (
    <div className="space-y-5">

      {/* KPI GRID */}

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
          value={String(activeHosts)}
          detail={`${totalHosts} total hosts`}
          icon={
            <Users className="h-4 w-4" />
          }
          tone="green"
        />

        <StatTile
          label="Active tasks"
          value={String(
            dashboard?.activeTasks ?? 0,
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
            dashboard?.pendingPayouts ?? 0,
          )}
          detail="Awaiting processing"
          icon={
            <WalletCards className="h-4 w-4" />
          }
          tone="blue"
        />
      </div>

      {/* PERFORMANCE */}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">

        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-5 sm:p-6">

          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/20">
                Performance
              </p>

              <h3 className="mt-1 text-sm font-black text-white">
                Agency health
              </h3>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/[.07] text-violet-200/50">
              <Activity className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-7 space-y-6">
            <Progress
              label="Active host ratio"
              value={hostRatio}
            />

            <Progress
              label="Task completion"
              value={taskCompletion}
            />
          </div>
        </div>

        {/* OWNER CARD */}

        <div className="rounded-2xl border border-amber-300/[.08] bg-gradient-to-br from-violet-400/[.08] via-white/[.015] to-amber-400/[.05] p-5 sm:p-6">

          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/20">
            Agency operations
          </p>

          <h3 className="mt-2 text-sm font-black text-white">
            Keep your network moving
          </h3>

          <div className="mt-5 space-y-4">

            <InfoRow
              icon={
                <Clock3 className="h-4 w-4" />
              }
              text="Review new creator applications."
            />

            <InfoRow
              icon={
                <Users className="h-4 w-4" />
              }
              text="Manage hosts and monitor performance."
            />

            <InfoRow
              icon={
                <WalletCards className="h-4 w-4" />
              }
              text="Track commissions and payouts."
            />

          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}

      <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-5 sm:p-6">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/20">
              Activity
            </p>

            <h3 className="mt-1 text-sm font-black text-white">
              Recent agency activity
            </h3>
          </div>

          <Activity className="h-4 w-4 text-white/15" />
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-white/[.07] px-5 py-10 text-center">
          <p className="text-xs font-bold text-white/35">
            Agency activity will appear here
          </p>

          <p className="mt-1 text-[10px] text-white/20">
            Applications, host activity, tasks and
            payouts will be shown as they happen.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* APPLICATIONS */
/* -------------------------------------------------------------------------- */

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
    action: "approve" | "reject",
  ) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-2xl bg-white/[.025]" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/[.025]" />
        <div className="h-20 animate-pulse rounded-2xl bg-white/[.025]" />
      </div>
    );
  }

  if (!applications.length) {
    return (
      <Empty
        icon={<FileCheck2 />}
        title="No pending applications"
        text="New creator applications will appear here for review."
      />
    );
  }

  return (
    <div className="space-y-3">

      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/20">
            Join requests
          </p>

          <h3 className="mt-1 text-sm font-black text-white">
            Review creators
          </h3>
        </div>

        <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[9px] font-black text-violet-200">
          {applications.length} pending
        </span>
      </div>

      {applications.map((application) => (
        <div
          key={application.userId}
          className="group flex flex-col gap-4 rounded-2xl border border-white/[.06] bg-white/[.018] p-4 transition hover:border-white/[.1] hover:bg-white/[.025] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-400/10 text-sm font-black text-violet-200">
              {application.avatar ? (
                <img
                  src={application.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                application.name
                  ?.charAt(0)
                  ?.toUpperCase() || "?"
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {application.name}
              </p>

              <p className="mt-1 truncate text-[10px] text-white/25">
                @{application.handle}
                {" · "}
                Level {application.level}
                {application.countryFlag
                  ? ` · ${application.countryFlag}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              disabled={busy === application.userId}
              onClick={() =>
                onReview(
                  application.userId,
                  "reject",
                )
              }
              className="rounded-xl border border-red-300/10 bg-red-400/[.04] px-4 py-2.5 text-[10px] font-black text-red-300/60 transition hover:bg-red-400/[.08] disabled:opacity-40"
            >
              Reject
            </button>

            <button
              type="button"
              disabled={busy === application.userId}
              onClick={() =>
                onReview(
                  application.userId,
                  "approve",
                )
              }
              className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-black text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              Approve
            </button>

          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENTS */
/* -------------------------------------------------------------------------- */

function Progress({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold text-white/30">
        <span>{label}</span>
        <span>{value}%</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-amber-300 transition-all duration-500"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value),
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 text-xs leading-5 text-white/35">
      <span className="mt-0.5 text-violet-200/50">
        {icon}
      </span>

      <span>{text}</span>
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[.08] bg-white/[.012] px-6 py-20 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.04] text-white/20 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>

      <h3 className="mt-4 text-sm font-black text-white/55">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-white/25">
        {text}
      </p>
    </div>
  );
}