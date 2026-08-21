"use client";

import {
    Building2,
    CheckCircle2,
    ChevronRight,
    Clock3,
    KeyRound,
    Loader2,
    Search,
    ShieldCheck,
    Users,
    X,
    Sparkles,
    ArrowRight,
    AlertCircle,
    UserPlus,
    Clock,
    Check,
    Zap,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Agency } from "@/lib/api/agency";
import { useAgency } from "@/hooks/use-agency";
import { AgencyHero } from "@/components/agency/agency-hero";
import { DiscoverPanel } from "@/components/agency/discover-panel";
import { MyAgencyPanel } from "@/components/agency/my-agency-panel";

// ─── Utility ────────────────────────────────────────────────────────────────

const fadeInUp = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
};

const stagger = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { delay, duration: 0.35, ease: [0.23, 1, 0.32, 1] } },
});

// ─── Main Component ─────────────────────────────────────────────────────────

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

    const membershipStatus = myAgency?.membershipStatus ?? null;
    const isPending = membershipStatus === "pending";
    const isApproved = membershipStatus === "approved";

    const [pageReady, setPageReady] = useState(false);

    useEffect(() => {
        const timer = requestAnimationFrame(() => setPageReady(true));
        return () => cancelAnimationFrame(timer);
    }, []);

    // ── Loading ──

    if (loading) {
        return (
            <main className="min-h-dvh bg-[#0b0910] px-4 py-8 text-white">
                <div className="mx-auto max-w-[1500px]">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-white/[.05]" />
                        <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[.035]" />
                    </div>
                    <div className="mt-6 h-9 w-64 animate-pulse rounded-xl bg-white/[.04]" />
                    <div className="mt-2 h-4 w-96 animate-pulse rounded-lg bg-white/[.025]" />
                    <div className="mt-10 h-[320px] animate-pulse rounded-[32px] bg-white/[.02]" />
                </div>
            </main>
        );
    }

    // ── Render ──

    return (
        <main className="min-h-dvh bg-[#0b0910] text-[#f8f1e6] antialiased selection:bg-violet-500/30">
            {/* ── Atmosphere ── */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-[20%] top-[-320px] h-[700px] w-[800px] rounded-full bg-violet-500/[.06] blur-[160px]" />
                <div className="absolute bottom-[-280px] right-[-180px] h-[540px] w-[540px] rounded-full bg-amber-400/[.03] blur-[150px]" />
                <div className="absolute left-[60%] top-[40%] h-[300px] w-[300px] rounded-full bg-emerald-400/[.015] blur-[120px]" />
            </div>

            <div className="relative mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
                {/* ── Header ── */}
                <header
                    className="border-b border-white/[.05] pb-6 transition-opacity duration-700"
                    style={{ opacity: pageReady ? 1 : 0 }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/8 bg-violet-400/8 text-violet-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,.04)]">
                            <Building2 className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[.28em] text-white/20">
                            Subha · Agency Network
                        </span>
                    </div>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                                Agency Center
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/25">
                                Join an agency, build your creator network, manage hosts and track your earnings.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 rounded-full border border-white/[.05] bg-white/[.018] px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
                                {totalAgencyCount} active agencies
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── Error ── */}
                {error && !joinDialogOpen && (
                    <div
                        className="mt-5 flex items-center gap-3 rounded-2xl border border-red-400/12 bg-red-400/[.04] px-4 py-3 text-xs text-red-300/80 transition-all"
                        style={fadeInUp.animate}
                    >
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-300/50" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ── Pending ── */}
                {isPending && myAgency && (
                    <div className="mt-6 transition-all duration-500">
                        <PendingMembership agency={myAgency} onCancel={leave} />
                    </div>
                )}

                {/* ── Approved ── */}
                {isApproved && myAgency && (
                    <div className="mt-6 transition-all duration-500">
                        <MyAgencyPanel agency={myAgency} onLeave={leave} />
                    </div>
                )}

                {/* ── No Agency ── */}
                {!myAgency && (
                    <>
                        <div className="mt-6 transition-all duration-700" style={{ opacity: pageReady ? 1 : 0 }}>
                            <AgencyHero
                                myAgency={null}
                                onManage={() => undefined}
                                onExplore={() =>
                                    document.getElementById("agency-list")?.scrollIntoView({
                                        behavior: "smooth",
                                    })
                                }
                            />
                        </div>

                        <div id="agency-list" className="mt-8 scroll-mt-24 transition-all duration-500">
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

            {/* ── Join Modal ── */}
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

// ─── JOIN AGENCY MODAL ─────────────────────────────────────────────────────

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
    onSubmit: (code: string) => Promise<Agency>;
}) {
    const [code, setCode] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [step, setStep] = useState<"code" | "submitting" | "success">("code");
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus
    useEffect(() => {
        if (step === "code") {
            const timer = setTimeout(() => inputRef.current?.focus(), 200);
            return () => clearTimeout(timer);
        }
    }, [step]);

    const displayedError = localError ?? error;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = code.trim();
        if (!normalized) {
            setLocalError("Please enter the agency code.");
            return;
        }
        setLocalError(null);
        setStep("submitting");
        try {
            await onSubmit(normalized);
            setStep("success");
            // Close after success animation
            setTimeout(() => {
                onClose();
            }, 800);
        } catch {
            setStep("code");
            // error is passed from parent
        }
    };

    const handleClose = () => {
        if (loading) return;
        setLocalError(null);
        setStep("code");
        onClose();
    };

    const isSuccess = step === "success";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-modal-title"
        >
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                disabled={loading}
                className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-md transition-opacity"
            />

            {/* Modal */}
            <div
                className={`
              relative z-10 w-full max-w-md overflow-hidden rounded-[32px] 
              border border-white/[.07] bg-[#110e16] 
              shadow-[0_40px_140px_rgba(0,0,0,.6)]
              transition-all duration-300
              ${isSuccess ? "scale-[0.98]" : "scale-100"}
            `}
            >
                {/* Glow */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-500/[.06] to-transparent" />
                <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-violet-500/[.04] blur-[80px]" />

                {/* ── Header ── */}
                <div className="relative border-b border-white/[.05] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/8 bg-violet-400/8 text-violet-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,.04)]">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/20">
                                    Join agency
                                </p>
                                <h2 id="join-modal-title" className="mt-1 text-lg font-black text-white">
                                    {agency.name}
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.05] bg-white/[.018] text-white/20 transition hover:bg-white/[.05] hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <form onSubmit={handleSubmit} className="relative p-5 sm:p-6">
                    {/* Agency preview card */}
                    <div className="rounded-2xl border border-white/[.04] bg-white/[.015] p-4 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/8 text-sm font-black text-violet-200/80">
                                {agency.name?.charAt(0)?.toUpperCase() || "A"}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">{agency.name}</p>
                                <p className="mt-0.5 text-[10px] text-white/20">
                                    {step === "success" ? "✓ Access granted" : "Private agency code required"}
                                </p>
                            </div>
                            {step === "success" ? (
                                <div className="ml-auto rounded-full bg-emerald-400/10 p-1.5 text-emerald-300">
                                    <Check className="h-4 w-4" />
                                </div>
                            ) : (
                                <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300/20" />
                            )}
                        </div>
                    </div>

                    {/* ── Steps indicator ── */}
                    {step !== "success" && (
                        <div className="mt-5 flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-6 rounded-full bg-violet-400/40" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                                <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                            </div>
                            <span className="text-[9px] font-medium uppercase tracking-[.12em] text-white/15">
                                Step 1 of 2
                            </span>
                        </div>
                    )}

                    {/* ── Info box ── */}
                    {step !== "success" && (
                        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/6 bg-amber-400/[.03] p-4">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/40" />
                            <div>
                                <p className="text-xs font-bold text-white/50">Owner approval required</p>
                                <p className="mt-1 text-[11px] leading-5 text-white/25">
                                    Enter the agency's private code. The owner must approve your request before you
                                    become a member.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Code input ── */}
                    {step === "code" && (
                        <div className="mt-5">
                            <label htmlFor="agency-code" className="mb-2 block text-[9px] font-black uppercase tracking-[.18em] text-white/25">
                                Agency code
                            </label>
                            <div className="relative">
                                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/15" />
                                <input
                                    ref={inputRef}
                                    id="agency-code"
                                    type="text"
                                    autoComplete="off"
                                    autoFocus
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        setLocalError(null);
                                    }}
                                    placeholder="Enter private agency code"
                                    disabled={loading}
                                    className="h-12 w-full rounded-xl border border-white/[.06] bg-white/[.018] pl-10 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-white/12 focus:border-violet-300/25 focus:bg-white/[.03] disabled:cursor-not-allowed disabled:opacity-40"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Submitting state ── */}
                    {step === "submitting" && (
                        <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/[.04] bg-white/[.015] px-4 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-violet-300/50" />
                            <span className="text-sm font-medium text-white/30">Submitting your request…</span>
                        </div>
                    )}

                    {/* ── Success state ── */}
                    {step === "success" && (
                        <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[.04] px-4 py-3">
                            <CheckCircle2 className="h-4 w-4 text-emerald-300/60" />
                            <span className="text-sm font-medium text-emerald-200/60">Request sent successfully!</span>
                        </div>
                    )}

                    {/* ── Error ── */}
                    {displayedError && step !== "success" && (
                        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-400/10 bg-red-400/[.04] px-3 py-2.5 text-xs leading-5 text-red-300/70">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300/40" />
                            <span>{displayedError}</span>
                        </div>
                    )}

                    {/* ── Buttons ── */}
                    {step !== "success" && (
                        <div className="mt-6 flex gap-2.5">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={loading}
                                className="flex-1 rounded-xl border border-white/[.05] bg-white/[.015] px-4 py-3 text-xs font-black text-white/30 transition hover:bg-white/[.04] hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={loading || !code.trim()}
                                className="group flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-black transition hover:bg-[#f8f1e6] hover:shadow-[0_8px_30px_rgba(255,255,255,.06)] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        Request to join
                                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* ── Footer note ── */}
                    {step !== "success" && (
                        <p className="mt-4 text-center text-[9px] leading-4 text-white/12">
                            Your account will remain pending until the agency owner approves.
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}

// ─── PENDING MEMBERSHIP ────────────────────────────────────────────────────

function PendingMembership({
    agency,
    onCancel,
}: {
    agency: Agency;
    onCancel: () => Promise<void> | void;
}) {
    const [isHovering, setIsHovering] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const handleCancel = async () => {
        if (isCancelling) return;
        setIsCancelling(true);
        try {
            await onCancel();
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <section
            className="relative min-h-[600px] overflow-hidden rounded-[32px] border border-white/[.04] bg-gradient-to-br from-[#0f0c14] via-[#0f0c14] to-[#120e1a] p-6 sm:p-10 lg:p-14"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-amber-400/[.03] blur-[100px]" />
                <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-violet-500/[.02] blur-[100px]" />
            </div>

            <div className="relative flex min-h-[540px] items-center justify-center">
                <div className="w-full max-w-xl text-center">
                    {/* Icon with pulse */}
                    <div className="relative mx-auto w-fit">
                        <div className="absolute inset-0 animate-ping rounded-[28px] bg-amber-400/10 blur-xl" />
                        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-amber-300/8 bg-amber-400/[.05] text-amber-200/80 shadow-[inset_0_1px_1px_rgba(255,255,255,.04)]">
                            <Clock3 className="h-8 w-8" />
                        </div>
                    </div>

                    <p className="mt-7 text-[10px] font-black uppercase tracking-[.25em] text-amber-200/35">
                        Application pending
                    </p>

                    <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Waiting for approval</h2>

                    <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/25">
                        Your request to join{" "}
                        <span className="font-bold text-white/50">{agency.name}</span> has been submitted. The agency
                        owner needs to approve your application before you can access the workspace.
                    </p>

                    {/* ── Status card ── */}
                    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/[.04] bg-white/[.015] p-5 text-left transition-all hover:border-white/[.07]">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/8 bg-violet-400/8 text-violet-200/70">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-white">{agency.name}</p>
                                <p className="mt-0.5 text-[10px] text-white/20">Membership application</p>
                            </div>
                            <div className="ml-auto">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/8 px-3 py-1 text-[9px] font-black uppercase text-amber-200/60">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/60" />
                                    Pending
                                </span>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="mt-5 border-t border-white/[.04] pt-5">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                    <div className="h-2 w-2 rounded-full bg-amber-300/40" />
                                    <div className="my-0.5 h-6 w-px bg-white/6" />
                                    <div className="h-2 w-2 rounded-full bg-white/10" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white/40">Request submitted</p>
                                    <p className="text-[10px] text-white/15">Awaiting owner approval</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[.03] bg-white/[.015] px-3 py-2.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-200/25" />
                            <span className="text-[11px] text-white/20">
                                You'll get access automatically once the owner approves.
                            </span>
                        </div>
                    </div>

                    {/* ── Cancel button ── */}
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className={`
                            group mt-7 inline-flex items-center gap-2 rounded-xl 
                            border border-white/[.05] bg-white/[.015] px-5 py-3 
                            text-xs font-black text-white/25 transition-all
                            hover:border-red-300/8 hover:bg-red-400/[.04] hover:text-red-300/60
                            disabled:cursor-not-allowed disabled:opacity-30
                        `}
                    >
                        {isCancelling ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Cancelling…
                            </>
                        ) : (
                            <>
                                <X className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
                                Cancel application
                            </>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}