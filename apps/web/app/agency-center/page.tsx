"use client";

import * as React from "react";
import Image from "next/image";
import {
    Building2,
    CheckCircle2,
    Clock3,
    KeyRound,
    Loader2,
    ShieldCheck,
    X,
    AlertCircle,
    Check,
} from "lucide-react";
import { toast } from "sonner";

import { useAgency } from "@/hooks/use-agency";
import { MyAgencyPanel } from "@/components/agency/my-agency-panel";
import { type Agency } from "@/lib/api/agency";   // <-- ADD THIS IMPORT

// ─── Main Component ────────────────────────────────────────────────────────

export default function AgencyCenterPage() {
    const {
        myAgency,
        loading,
        joining,
        error,
        joinWithCode,
        leave,
    } = useAgency();

    const membershipStatus = myAgency?.membershipStatus ?? null;
    const isPending = membershipStatus === "pending";
    const isApproved = membershipStatus === "approved";

    const [code, setCode] = React.useState("");
    const [localError, setLocalError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    React.useEffect(() => {
        if (!loading && !myAgency) {
            const timer = setTimeout(() => inputRef.current?.focus(), 300);
            return () => clearTimeout(timer);
        }
    }, [loading, myAgency]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) {
            setLocalError("Please enter the agency code.");
            return;
        }
        setLocalError(null);
        setIsSubmitting(true);
        try {
            const agency = await joinWithCode(trimmed);
            toast.success(`Request submitted for ${agency.name}!`);
        } catch (err: any) {
            toast.error("Could not join", {
                description: err?.message || "Please check the code and try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Loading ──
    if (loading) {
        return (
            <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient">
                <LoadingSkeleton />
            </main>
        );
    }

    // ── Pending ──
    if (isPending && myAgency) {
        return (
            <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient">
                <BackgroundEffects />
                <div className="relative z-10 mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 py-10">
                    <PendingMembershipCard agency={myAgency} onCancel={leave} />
                </div>
            </main>
        );
    }

    // ── Approved ──
    if (isApproved && myAgency) {
        return (
            <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient">
                <BackgroundEffects />
                <div className="relative z-10 mx-auto max-w-[1200px] px-4 py-8">
                    <MyAgencyPanel agency={myAgency} onLeave={leave} />
                </div>
            </main>
        );
    }

    // ── No Agency ──
    return (
        <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient">
            <BackgroundEffects />

            <div className="relative z-10 mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center px-6 py-10">
                {/* Logo */}
                <div className="shrink-0 animate-[fadeIn_0.6s_ease-out]">
                    <span
                        className="font-display text-[2.2rem] font-bold uppercase tracking-[-0.05em] bg-clip-text text-transparent sm:text-[2.45rem]"
                        style={{
                            backgroundImage:
                                "linear-gradient(90deg, var(--accent) 0%, var(--accent-hot) 50%, var(--accent) 100%)",
                            backgroundSize: "200% auto",
                            animation: "gradientShift 6s ease-in-out infinite",
                        }}
                    >
                        SUBHA
                    </span>
                </div>

                {/* Hero */}
                <section className="mt-6 flex w-full flex-col items-center animate-[fadeIn_0.6s_ease-out_0.1s_both]">
                    <div className="relative h-40 w-40 sm:h-48 sm:w-48 animate-[floatIn_0.7s_ease-out_0.2s_both]">
                        <div
                            aria-hidden
                            className="absolute inset-6 rounded-full bg-gradient-to-b from-accent/20 via-accent/10 to-accent-hot/10 blur-2xl"
                        />
                        {/* Orbiting particles */}
                        <div
                            aria-hidden
                            className="absolute inset-0 animate-[orbit_14s_linear_infinite]"
                        >
                            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_2px] shadow-accent/60" />
                        </div>
                        <div
                            aria-hidden
                            className="absolute inset-0 animate-[orbit_10s_linear_infinite_reverse]"
                        >
                            <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-accent-hot shadow-[0_0_8px_2px] shadow-accent-hot/60" />
                        </div>
                        <div
                            aria-hidden
                            className="absolute inset-0 animate-[orbit_18s_linear_infinite]"
                            style={{ animationDelay: "-4s" }}
                        >
                            <span className="absolute bottom-4 left-0 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_8px_2px] shadow-fuchsia-300/50" />
                        </div>

                        <div className="relative h-full w-full animate-[breathe_5s_ease-in-out_infinite]">
                            <Image
                                src="/mascot.png"
                                alt="Subha mascot"
                                fill
                                sizes="192px"
                                priority
                                className="object-contain drop-shadow-[0_20px_30px_rgba(76,40,150,0.25)]"
                            />
                        </div>
                        {/* Shadow */}
                        <div
                            aria-hidden
                            className="absolute bottom-1 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-black/30 blur-md animate-[shadowPulse_5s_ease-in-out_infinite]"
                        />
                    </div>

                    <h1 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">
                        Join an Agency
                    </h1>
                    <p className="mt-1.5 text-sm text-ink-muted sm:text-base">
                        Enter your agency code to get started
                    </p>
                </section>

                {/* Code Form */}
                <section className="mt-8 w-full animate-[fadeIn_0.6s_ease-out_0.3s_both]">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="agency-code"
                                    className="block text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted/60"
                                >
                                    Agency code
                                </label>
                                <div className="relative mt-2">
                                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/40" />
                                    <input
                                        ref={inputRef}
                                        id="agency-code"
                                        type="text"
                                        autoComplete="off"
                                        value={code}
                                        onChange={(e) => {
                                            setCode(e.target.value);
                                            setLocalError(null);
                                        }}
                                        placeholder="e.g. ABC123"
                                        disabled={isSubmitting}
                                        className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-4 text-sm font-bold text-ink outline-none transition placeholder:text-ink-muted/30 focus:border-accent/40 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                {(localError || error) && (
                                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-400/10 bg-red-400/[0.04] px-3 py-2 text-xs text-red-300/70">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300/40" />
                                        <span>{localError || error}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !code.trim()}
                                className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black transition-all hover:bg-[#f8f1e6] hover:shadow-[0_8px_30px_rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending request…
                                    </>
                                ) : (
                                    <>
                                        Request to join
                                        <Check className="h-4 w-4 transition-transform group-hover:scale-110" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-300/5 bg-amber-400/[0.02] px-3 py-2.5">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-200/30" />
                            <p className="text-[10.5px] leading-relaxed text-ink-muted/50">
                                The agency owner will review and approve your request.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <p className="mt-6 text-[10.5px] text-ink-muted/40 animate-[fadeIn_0.6s_ease-out_0.4s_both]">
                    Need an agency? Contact your creator network administrator.
                </p>
            </div>

            {/* Inline global styles */}
            <style jsx global>{`
                :root {
                    --accent: #a78bfa;
                    --accent-hot: #c084fc;
                    --ink: #f8f1e6;
                    --ink-muted: rgba(248, 241, 230, 0.6);
                    --bg-gradient: #0b0910;
                }

                .bg-Subha-gradient {
                    background: var(--bg-gradient);
                }

                @media (prefers-reduced-motion: reduce) {
                    * {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes floatIn {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes breathe {
                    0%,
                    100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-6px);
                    }
                }

                @keyframes shadowPulse {
                    0%,
                    100% {
                        transform: translateX(-50%) scale(1);
                        opacity: 0.3;
                    }
                    50% {
                        transform: translateX(-50%) scale(0.85);
                        opacity: 0.15;
                    }
                }

                @keyframes orbit {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @keyframes gradientShift {
                    0%,
                    100% {
                        background-position: 0% center;
                    }
                    50% {
                        background-position: 100% center;
                    }
                }

                @keyframes pulseGlow {
                    0%,
                    100% {
                        opacity: 0.06;
                    }
                    50% {
                        opacity: 0.12;
                    }
                }
            `}</style>
        </main>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function BackgroundEffects() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[120px]" />
            <div className="absolute left-1/2 top-[38%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.06] blur-[120px] animate-[pulseGlow_8s_ease-in-out_infinite]" />
            <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px]" />
            <div className="absolute -bottom-32 -right-40 h-[450px] w-[450px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />
            <div className="absolute -bottom-[250px] left-1/2 h-[420px] w-[150%] -translate-x-1/2 rounded-[50%] bg-accent/[0.08]" />
            <div className="absolute -bottom-[290px] left-1/2 h-[420px] w-[135%] -translate-x-1/2 rounded-[50%] bg-accent-hot/[0.08]" />
            {/* Grain overlay */}
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center px-6 py-10">
            <div className="h-10 w-32 animate-pulse rounded-xl bg-white/[0.05]" />
            <div className="mt-10 h-48 w-48 animate-pulse rounded-full bg-white/[0.03]" />
            <div className="mt-6 h-6 w-48 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-white/[0.025]" />
            <div className="mt-8 h-56 w-full animate-pulse rounded-2xl bg-white/[0.02]" />
        </div>
    );
}

function PendingMembershipCard({
    agency,
    onCancel,
}: {
    agency: Agency;
    onCancel: () => Promise<void> | void;
}) {
    const [isCancelling, setIsCancelling] = React.useState(false);

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
        <div className="w-full max-w-md rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.3)] animate-[floatIn_0.5s_ease-out]">
            <div className="flex flex-col items-center text-center">
                <div className="relative mx-auto w-fit">
                    <div className="absolute inset-0 animate-ping rounded-2xl bg-amber-400/10 blur-xl" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-300/10 bg-amber-400/[0.05] text-amber-200/80">
                        <Clock3 className="h-8 w-8" />
                    </div>
                </div>

                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200/40">
                    Application pending
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Waiting for approval</h2>

                <p className="mt-3 text-sm leading-relaxed text-ink-muted/60">
                    Your request to join{" "}
                    <span className="font-bold text-ink/70">{agency.name}</span> has been submitted. The agency owner
                    will review it shortly.
                </p>

                <div className="mt-6 w-full rounded-xl border border-white/[0.04] bg-white/[0.015] p-4 text-left">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200/70">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-ink">{agency.name}</p>
                            <p className="text-[10px] text-ink-muted/40">Membership request</p>
                        </div>
                        <div className="ml-auto">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-[9px] font-black uppercase text-amber-200/60">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300/60" />
                                Pending
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="group mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-xs font-bold text-ink-muted/50 transition-all hover:border-red-300/10 hover:bg-red-400/[0.04] hover:text-red-300/70 disabled:cursor-not-allowed disabled:opacity-30"
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
    );
}