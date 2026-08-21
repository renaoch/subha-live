"use client";

import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  KeyRound,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";

import { useState } from "react";

import type { Agency } from "@/lib/api/agency";

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
    error,
    filteredAgencies,
    totalAgencyCount,

    join,
    submitJoin,
    cancelJoin,

    selectedAgency,
    joinDialogOpen,

    leave,
  } = useAgency();

  const membershipStatus =
    myAgency?.membershipStatus ?? null;

  const isPending =
    membershipStatus === "pending";

  const isApproved =
    membershipStatus === "approved";

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

  return (
    <main className="min-h-dvh bg-[#0b0910] text-[#f8f1e6]">
      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[25%] top-[-280px] h-[620px] w-[760px] rounded-full bg-violet-500/[.07] blur-[150px]" />

        <div className="absolute bottom-[-280px] right-[-160px] h-[500px] w-[500px] rounded-full bg-amber-400/[.035] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        {/* ================================================================== */}
        {/* HEADER                                                             */}
        {/* ================================================================== */}

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

        {/* ================================================================== */}
        {/* ERROR                                                              */}
        {/* ================================================================== */}

        {error && !joinDialogOpen && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[.05] px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* ================================================================== */}
        {/* PENDING MEMBERSHIP                                                 */}
        {/* ================================================================== */}

        {isPending && myAgency && (
          <PendingMembership
            agency={myAgency}
            onCancel={leave}
          />
        )}

        {/* ================================================================== */}
        {/* APPROVED MEMBERSHIP                                                */}
        {/* ================================================================== */}

        {isApproved && myAgency && (
          <MyAgencyPanel
            agency={myAgency}
            onLeave={leave}
          />
        )}

        {/* ================================================================== */}
        {/* NO AGENCY                                                          */}
        {/* ================================================================== */}

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

      {/* ==================================================================== */}
      {/* JOIN AGENCY MODAL                                                   */}
      {/* ==================================================================== */}

      {joinDialogOpen && selectedAgency && (
        <JoinAgencyModal
          agency={selectedAgency}
          loading={joining === selectedAgency.id}
          onClose={cancelJoin}
          onSubmit={submitJoin}
          error={error}
        />
      )}
    </main>
  );
}

/* ============================================================================
 * JOIN AGENCY MODAL
 * ========================================================================== */

function JoinAgencyModal({
  agency,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  agency: Agency;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    code: string,
  ) => Promise<Agency>;
}) {
  const [code, setCode] = useState("");

  const [localError, setLocalError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedCode =
      code.trim();

    if (!normalizedCode) {
      setLocalError(
        "Enter the agency code.",
      );
      return;
    }

    try {
      setLocalError(null);

      await onSubmit(
        normalizedCode,
      );
    } catch {
      /*
       * The parent hook already stores the
       * API error. We intentionally don't
       * close the modal here.
       */
    }
  }

  function handleClose() {
    if (loading) {
      return;
    }

    setLocalError(null);
    onClose();
  }

  const displayedError =
    localError ?? error;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        disabled={loading}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-md"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[30px] border border-white/[.09] bg-[#110e16] shadow-[0_30px_120px_rgba(0,0,0,.55)]">
        {/* Top glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/[.08] to-transparent" />

        {/* Header */}
        <div className="relative border-b border-white/[.06] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/10 bg-violet-400/10 text-violet-200">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/25">
                  Join agency
                </p>

                <h2 className="mt-1 text-lg font-black text-white">
                  {agency.name}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.07] bg-white/[.025] text-white/30 transition hover:bg-white/[.06] hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="relative p-6"
        >
          {/* Agency preview */}
          <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-sm font-black text-violet-200">
                {agency.name
                  ?.charAt(0)
                  ?.toUpperCase() || "A"}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {agency.name}
                </p>

                <p className="mt-0.5 text-[10px] text-white/25">
                  Agency code required
                </p>
              </div>

              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300/40" />
            </div>
          </div>

          {/* Explanation */}
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/10 bg-amber-400/[.04] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/60" />

            <div>
              <p className="text-xs font-bold text-white/60">
                Approval is required
              </p>

              <p className="mt-1 text-[11px] leading-5 text-white/30">
                Enter the agency's private code.
                Your request will be placed in
                pending status. The agency owner
                must approve you before you become
                a member.
              </p>
            </div>
          </div>

          {/* Code input */}
          <div className="mt-5">
            <label
              htmlFor="agency-code"
              className="mb-2 block text-[9px] font-black uppercase tracking-[.18em] text-white/30"
            >
              Agency code
            </label>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />

              <input
                id="agency-code"
                type="text"
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value,
                  );
                  setLocalError(null);
                }}
                placeholder="Enter private agency code"
                disabled={loading}
                className="h-12 w-full rounded-xl border border-white/[.08] bg-white/[.025] pl-10 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-violet-300/30 focus:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {/* Error */}
          {displayedError && (
            <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[.05] px-3 py-2.5 text-xs leading-5 text-red-300">
              {displayedError}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 text-xs font-black text-white/45 transition hover:bg-white/[.05] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                !code.trim()
              }
              className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-black transition hover:bg-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending request...
                </>
              ) : (
                <>
                  Request to join
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-4 text-center text-[9px] leading-4 text-white/20">
            Your account will remain pending until
            the agency owner approves the request.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ============================================================================
 * PENDING MEMBERSHIP
 * ========================================================================== */

function PendingMembership({
  agency,
  onCancel,
}: {
  agency: Agency;
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