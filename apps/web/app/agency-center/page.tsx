"use client";

import {
  Building2,
  ChevronRight,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import { useAgency } from "@/hooks/use-agency";
import { AgencyHero } from "@/components/agency/agency-hero";
import { DiscoverPanel } from "@/components/agency/discover-panel";
import { MyAgencyPanel } from "@/components/agency/my-agency-panel";

export default function AgencyCenterPage() {
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
      <main className="min-h-dvh bg-[#0b0910] px-4 py-8 text-white">
        <div className="mx-auto max-w-[1500px]">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-white/[.05]" />

          <div className="mt-3 h-4 w-72 animate-pulse rounded-lg bg-white/[.035]" />

          <div className="mt-8 h-[280px] animate-pulse rounded-[28px] bg-white/[.025]" />
        </div>
      </main>
    );
  }

  /*
   * IMPORTANT:
   *
   * myAgency can represent:
   *
   * null
   *   -> user has no agency
   *
   * pending membership
   *   -> user requested to join but owner has not approved
   *
   * approved membership
   *   -> user can access the workspace
   */

  const membershipStatus =
    myAgency?.membershipStatus ?? null;

  const isPending =
    membershipStatus === "pending";

  const isApproved =
    membershipStatus === "approved";

  return (
    <main className="min-h-dvh bg-[#0b0910] text-[#f8f1e6]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[25%] top-[-280px] h-[620px] w-[760px] rounded-full bg-violet-500/[.07] blur-[150px]" />

        <div className="absolute bottom-[-280px] right-[-160px] h-[500px] w-[500px] rounded-full bg-amber-400/[.035] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">

        {/* HEADER */}

        <header className="border-b border-white/[.06] pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-200">
              <Building2 className="h-4 w-4" />
            </div>

            <span className="text-[9px] font-black uppercase tracking-[.28em] text-white/25">
              Subha · Agency Network
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Agency Center
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/30">
                Join an agency, build your creator network,
                manage hosts and track your earnings.
              </p>
            </div>

            <div className="rounded-full border border-white/[.06] bg-white/[.025] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/25">
              {totalAgencyCount} active agencies
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[.05] px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* ============================================================= */}
        {/* PENDING MEMBERSHIP                                            */}
        {/* ============================================================= */}

        {isPending && myAgency && (
          <PendingMembership
            agency={myAgency}
            onCancel={leave}
          />
        )}

        {/* ============================================================= */}
        {/* APPROVED MEMBERSHIP                                          */}
        {/* ============================================================= */}

        {isApproved && myAgency && (
          <MyAgencyPanel
            agency={myAgency}
            onLeave={leave}
          />
        )}

        {/* ============================================================= */}
        {/* NO AGENCY                                                      */}
        {/* ============================================================= */}

        {!myAgency && (
          <>
            <AgencyHero
              myAgency={null}
              onManage={() => undefined}
              onExplore={() =>
                document
                  .getElementById("agency-list")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            />

            <div
              id="agency-list"
              className="mt-7"
            >
              <DiscoverPanel
                agencies={filteredAgencies}
                search={search}
                onSearchChange={setSearch}
                joiningId={joining}
                hasAgency={false}
                onJoin={join}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ========================================================================== */
/* PENDING MEMBERSHIP                                                         */
/* ========================================================================== */

function PendingMembership({
  agency,
  onCancel,
}: {
  agency: any;
  onCancel: () => Promise<void> | void;
}) {
  return (
    <section className="mt-8 min-h-[650px] rounded-[30px] border border-white/[.06] bg-[#0f0c14] p-6 sm:p-10 lg:p-14">
      <div className="flex min-h-[560px] items-center justify-center">
        <div className="w-full max-w-xl text-center">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-300/10 bg-amber-400/[.06] text-amber-200">
            <Clock3 className="h-8 w-8" />
          </div>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[.25em] text-amber-200/45">
            Application pending
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
            Waiting for approval
          </h2>

          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/30">
            Your request to join{" "}
            <span className="font-bold text-white/60">
              {agency.name}
            </span>{" "}
            has been submitted. The agency owner needs
            to approve your application before you can
            access the agency workspace.
          </p>

          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/[.06] bg-white/[.018] p-5 text-left">

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200">
                <Building2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-black text-white">
                  {agency.name}
                </p>

                <p className="mt-1 text-[10px] text-white/25">
                  Agency application
                </p>
              </div>

              <div className="ml-auto">
                <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase text-amber-200/70">
                  Pending
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-white/[.06] pt-5">
              <div className="flex items-center gap-3 text-xs text-white/35">
                <ShieldCheck className="h-4 w-4 text-amber-200/40" />

                <span>
                  You will automatically gain access once
                  the owner approves your request.
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="mt-7 rounded-xl border border-white/[.08] bg-white/[.025] px-5 py-3 text-xs font-black text-white/40 transition hover:border-red-300/10 hover:bg-red-400/[.04] hover:text-red-300"
          >
            Cancel application
          </button>
        </div>
      </div>
    </section>
  );
}