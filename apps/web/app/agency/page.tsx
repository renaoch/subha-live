"use client";

import { useEffect, useMemo, useState } from "react";
import {
  agencyApi,
  type Agency,
} from "@/lib/api/agency";

type ViewMode = "discover" | "my-agency";

export default function AgencyPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [myAgency, setMyAgency] =
    useState<Agency | null>(null);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [view, setView] =
    useState<ViewMode>("discover");

  const [error, setError] = useState<string | null>(
    null,
  );

  async function loadAgencyData() {
    try {
      setLoading(true);
      setError(null);

      const [agencyList, mine] =
        await Promise.all([
          agencyApi.list(),
          agencyApi.me(),
        ]);

      setAgencies(agencyList);
      setMyAgency(mine.agency);
    } catch (err) {
      console.error("AGENCY API ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load agencies.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgencyData();
  }, []);

  const filteredAgencies = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return agencies;
    }

    return agencies.filter((agency) =>
      [
        agency.name,
        agency.code,
      ].some((field) =>
        field
          .toLowerCase()
          .includes(value),
      ),
    );
  }, [agencies, search]);

  async function handleJoin(
    agency: Agency,
  ) {
    if (joining) return;

    try {
      setJoining(agency.id);
      setError(null);

      await agencyApi.join(agency.id);

      await loadAgencyData();
    } catch (err) {
      console.error(
        "AGENCY JOIN ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to join agency.",
      );
    } finally {
      setJoining(null);
    }
  }

  async function handleLeave() {
    try {
      setError(null);

      await agencyApi.leave();

      await loadAgencyData();
      setView("discover");
    } catch (err) {
      console.error(
        "AGENCY LEAVE ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to leave agency.",
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0C0911] px-4 py-6 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />

          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/[0.04]" />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-48 animate-pulse rounded-[28px] border border-white/[0.05] bg-white/[0.025]"
                />
              ),
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-[#0C0911] text-[#F8F1E6]">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-240px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#8B5CF6]/10 blur-[130px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-[#F59E0B]/[0.05] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#A855F7]/20 bg-[#A855F7]/10 text-[#D8B4FE]">
                ◆
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Subha Network
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Agency Center
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/35">
              Find an agency, join a creator
              network, or build your own.
            </p>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Current agency hero */}
        {myAgency ? (
          <section className="relative mt-8 overflow-hidden rounded-[32px] border border-[#D9A94A]/20 bg-gradient-to-br from-[#2A1D0C] via-[#18131D] to-[#100D15] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-72 w-72 rounded-full bg-[#F59E0B]/10 blur-[90px]" />

            <div className="relative">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-3xl shadow-[0_0_35px_rgba(245,158,11,0.15)]">
                    ◆
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#F59E0B]/60">
                      Your Agency
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {myAgency.name}
                    </h2>

                    <p className="mt-1 text-xs text-white/30">
                      Code ·{" "}
                      <span className="font-bold text-white/50">
                        {myAgency.code}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setView("my-agency")
                  }
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.07]"
                >
                  Manage Agency
                </button>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <Stat
                  label="Hosts"
                  value={String(
                    myAgency.totalHosts,
                  )}
                />

                <Stat
                  label="Revenue"
                  value={`₹${formatCompact(
                    myAgency.monthlyRevenue,
                  )}`}
                />

                <Stat
                  label="Commission"
                  value={`${myAgency.commissionRate}%`}
                />
              </div>
            </div>
          </section>
        ) : (
          <section className="relative mt-8 overflow-hidden rounded-[32px] border border-[#A855F7]/15 bg-gradient-to-br from-[#1D1429] via-[#15111B] to-[#0E0B12] p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#A855F7]/10 blur-[90px]" />

            <div className="relative max-w-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#A855F7]/10 text-xl text-[#D8B4FE]">
                ✦
              </div>

              <h2 className="mt-5 text-2xl font-black">
                You're independent.
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/35">
                Join an existing agency and
                connect with creators, or apply
                to create your own agency.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(
                        "agency-list",
                      )
                      ?.scrollIntoView({
                        behavior: "smooth",
                      })
                  }
                  className="rounded-2xl bg-[#A855F7] px-5 py-3 text-xs font-black text-white shadow-[0_10px_30px_rgba(168,85,247,0.2)] transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Explore Agencies
                </button>

                <button
                  type="button"
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-xs font-bold text-white/60 transition hover:bg-white/[0.06]"
                >
                  Apply for Agency
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5">
          <TabButton
            active={view === "discover"}
            onClick={() =>
              setView("discover")
            }
          >
            Discover
          </TabButton>

          {myAgency && (
            <TabButton
              active={view === "my-agency"}
              onClick={() =>
                setView("my-agency")
              }
            >
              My Agency
            </TabButton>
          )}
        </div>

        {/* My agency */}
        {view === "my-agency" &&
        myAgency ? (
          <MyAgency
            agency={myAgency}
            onLeave={handleLeave}
          />
        ) : (
          <section
            id="agency-list"
            className="mt-8"
          >
            {/* Search */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                  Creator networks
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Discover Agencies
                </h2>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search agencies..."
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
                />
              </div>
            </div>

            {/* Cards */}
            {filteredAgencies.length ===
            0 ? (
              <div className="mt-6 rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-xl text-white/20">
                  ◆
                </div>

                <h3 className="mt-4 text-sm font-bold text-white/50">
                  No agencies found
                </h3>

                <p className="mt-1 text-xs text-white/20">
                  Try another search.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredAgencies.map(
                  (agency) => (
                    <AgencyCard
                      key={agency.id}
                      agency={agency}
                      joining={
                        joining ===
                        agency.id
                      }
                      hasAgency={
                        Boolean(myAgency)
                      }
                      onJoin={() =>
                        handleJoin(
                          agency,
                        )
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function AgencyCard({
  agency,
  joining,
  hasAgency,
  onJoin,
}: {
  agency: Agency;
  joining: boolean;
  hasAgency: boolean;
  onJoin: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#15111B] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#A855F7]/20 hover:bg-[#18131F]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#A855F7]/[0.07] blur-3xl transition group-hover:bg-[#A855F7]/10" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A855F7]/20 bg-gradient-to-br from-[#A855F7]/15 to-[#F59E0B]/10 text-xl text-[#D8B4FE]">
              ◆
            </div>

            <div>
              <h3 className="font-black text-white">
                {agency.name}
              </h3>

              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/25">
                #{agency.code}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300/70">
            Active
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat
            label="Hosts"
            value={String(
              agency.totalHosts,
            )}
          />

          <MiniStat
            label="Revenue"
            value={`₹${formatCompact(
              agency.monthlyRevenue,
            )}`}
          />

          <MiniStat
            label="Commission"
            value={`${agency.commissionRate}%`}
          />
        </div>

        <button
          type="button"
          disabled={
            joining || hasAgency
          }
          onClick={onJoin}
          className={[
            "mt-4 w-full rounded-2xl py-3 text-xs font-black transition",
            hasAgency
              ? "cursor-not-allowed bg-white/[0.04] text-white/20"
              : "bg-white text-black hover:bg-[#F8F1E6]",
          ].join(" ")}
        >
          {joining
            ? "Requesting..."
            : hasAgency
              ? "Already in an agency"
              : "Request to Join"}
        </button>
      </div>
    </article>
  );
}

function MyAgency({
  agency,
  onLeave,
}: {
  agency: Agency;
  onLeave: () => void;
}) {
  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Hosts"
          value={String(
            agency.totalHosts,
          )}
        />

        <StatCard
          label="Monthly Revenue"
          value={`₹${formatCompact(
            agency.monthlyRevenue,
          )}`}
        />

        <StatCard
          label="Commission"
          value={`${agency.commissionRate}%`}
        />
      </div>

      <div className="mt-4 rounded-[28px] border border-white/[0.07] bg-[#15111B] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
              Agency
            </p>

            <h2 className="mt-1 text-xl font-black">
              {agency.name}
            </h2>
          </div>

          <span className="rounded-full bg-[#A855F7]/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#D8B4FE]">
            #{agency.code}
          </span>
        </div>

        <div className="mt-6 h-px bg-white/[0.05]" />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3 text-xs font-bold text-white/50"
          >
            Manage Hosts
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="rounded-2xl border border-red-400/10 bg-red-400/[0.05] px-5 py-3 text-xs font-bold text-red-300/60 transition hover:bg-red-400/10"
          >
            Leave Agency
          </button>
        </div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition",
        active
          ? "bg-white/[0.07] text-white"
          : "text-white/30 hover:text-white/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-[#15111B] p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.025] px-3 py-2.5">
      <p className="text-[7px] font-black uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1 text-xs font-bold text-white/60">
        {value}
      </p>
    </div>
  );
}

function formatCompact(
  value: number,
) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}