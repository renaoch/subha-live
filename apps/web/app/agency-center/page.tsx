"use client";

import {
  Building2,
  Compass,
} from "lucide-react";

import { useAgency } from "@/hooks/use-agency";
import { AgencyHero } from "@/components/agency/agency-hero";
import { DiscoverPanel } from "@/components/agency/discover-panel";
import { MyAgencyPanel } from "@/components/agency/my-agency-panel";

export default function AgencyPage() {
  const {
    myAgency,
    loading,
    joining,
    search,
    setSearch,
    view,
    setView,
    error,
    filteredAgencies,
    totalAgencyCount,
    join,
    leave,
  } = useAgency();

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0c0911] px-4 py-8 text-white">
        <div className="mx-auto max-w-[1500px]">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-white/[.06]" />

          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/[.04]" />

          <div className="mt-8 h-64 animate-pulse rounded-[30px] bg-white/[.025]" />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="h-52 animate-pulse rounded-[26px] bg-white/[.025]" />
            <div className="h-52 animate-pulse rounded-[26px] bg-white/[.025]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-[#0c0911] text-[#f8f1e6]">

      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[30%] top-[-260px] h-[560px] w-[720px] rounded-full bg-violet-500/[.07] blur-[140px]" />

        <div className="absolute bottom-[-260px] right-[-140px] h-[480px] w-[480px] rounded-full bg-amber-400/[.035] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">

        {/* PAGE HEADER */}

        <header className="flex flex-col gap-4 border-b border-white/[.05] pb-6 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-200">
                <Building2 className="h-4 w-4" />
              </div>

              <span className="text-[9px] font-black uppercase tracking-[.28em] text-white/25">
                Subha · Creator Network
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Agency Center
            </h1>

            <p className="mt-1.5 text-sm text-white/30">
              Manage your creator network, performance,
              applications and payouts.
            </p>

          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-white/[.06] bg-white/[.025] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
              {totalAgencyCount} active networks
            </span>
          </div>

        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[.06] px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* DISCOVER */}

        {view === "discover" && (
          <>
            <AgencyHero
              myAgency={myAgency}
              onManage={() => setView("my-agency")}
              onExplore={() =>
                document
                  .getElementById("agency-list")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            />

            <div className="mt-7">
              <DiscoverPanel
                agencies={filteredAgencies}
                search={search}
                onSearchChange={setSearch}
                joiningId={joining}
                hasAgency={Boolean(myAgency)}
                onJoin={join}
              />
            </div>
          </>
        )}

        {/* MY AGENCY */}

        {view === "my-agency" && myAgency && (
          <MyAgencyPanel
            agency={myAgency}
            onLeave={leave}
          />
        )}

      </div>
    </main>
  );
}