// File: app/agency/page.tsx
"use client";

import { Sparkles } from "lucide-react";

import { useAgency } from "@/hooks/use-agency";
import { AgencyHero } from "@/components/agency/agency-hero";
import { DiscoverPanel } from "@/components/agency/discover-panel";
import { MyAgencyPanel } from "@/components/agency/my-agency-panel";
import { TabButton } from "@/components/agency/tab-button";

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
    join,
    leave,
  } = useAgency();

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0C0911] px-4 py-6 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/[0.04]" />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-[28px] border border-white/[0.05] bg-white/[0.025]"
              />
            ))}
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
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Subha Network
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Agency Center
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/35">
              Find an agency, join a creator network, or build your own.
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <AgencyHero
          myAgency={myAgency}
          onManage={() => setView("my-agency")}
          onExplore={() =>
            document.getElementById("agency-list")?.scrollIntoView({ behavior: "smooth" })
          }
          onApply={() => {
            // Wire this up to your BD application flow (POST /api/v1/bd)
            // once that page/modal exists.
          }}
        />

        {/* Navigation */}
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5">
          <TabButton active={view === "discover"} onClick={() => setView("discover")}>
            Discover
          </TabButton>

          {myAgency && (
            <TabButton active={view === "my-agency"} onClick={() => setView("my-agency")}>
              My Agency
            </TabButton>
          )}
        </div>

        {view === "my-agency" && myAgency ? (
          <MyAgencyPanel agency={myAgency} onLeave={leave} />
        ) : (
          <DiscoverPanel
            agencies={filteredAgencies}
            search={search}
            onSearchChange={setSearch}
            joiningId={joining}
            hasAgency={Boolean(myAgency)}
            onJoin={join}
          />
        )}
      </div>
    </main>
  );
}