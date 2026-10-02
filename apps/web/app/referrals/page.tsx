"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Gift,
  Loader2,
  Share2,
  Users,
} from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";

function formatCoins(n: number) {
  return Math.trunc(n).toLocaleString("en-IN");
}

export default function ReferralsPage() {
  const { overview, history, loading, error, applying, applyResult, applyError, apply } =
    useReferrals();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-3xl bg-white/[0.04]" />
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
        </div>
      </Shell>
    );
  }

  if (error && !overview) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  if (!overview) return null;

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/referrals?code=${overview.code}`
      : `https://subha.fun/referrals?code=${overview.code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  async function share() {
    if (navigator.share) {
      navigator.share({ title: "Join Subha Live", url: inviteUrl }).catch(() => {});
    } else {
      await copyLink();
    }
  }

  return (
    <Shell>
      {/* Code card */}
      <div className="rounded-3xl border border-[#2A2238] bg-gradient-to-br from-[#241C33] to-[#17131F] p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">Your referral code</p>
        <p className="mt-2 font-mono text-3xl font-black tracking-[0.2em] text-[#E8C27A]">
          {overview.code}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
          >
            {copied ? <Gift className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E8C27A] to-[#C9923A] py-2.5 text-sm font-black text-[#1A1424] transition hover:brightness-105 active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon={Users} label="Friends invited" value={`${overview.totalReferrals}`} />
        <Stat icon={Gift} label="Coins earned" value={formatCoins(overview.totalRewardCoins)} />
      </div>

      <p className="mt-2 text-center text-xs text-white/40">
        Earn {formatCoins(overview.rewardPerReferral)} coins for each friend who joins with your code.
      </p>

      {/* Apply a code (for users who haven't yet) */}
      {!overview.alreadyApplied ? (
        <section className="mt-5 rounded-2xl border border-[#2A2238] bg-white/[0.03] p-4">
          <p className="text-sm font-bold text-white">Have a referral code?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={16}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-sm uppercase text-white outline-none placeholder:text-white/25 focus:border-[#E8C27A]/60"
            />
            <button
              type="button"
              onClick={() => void apply(code)}
              disabled={!code.trim() || applying}
              className="rounded-xl bg-[#E8C27A] px-4 text-sm font-black text-[#1A1424] transition hover:brightness-110 disabled:opacity-40"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>
          {applyError && <p className="mt-2 text-xs text-rose-300">{applyError}</p>}
          {applyResult && !applyResult.alreadyProcessed && (
            <p className="mt-2 text-xs text-emerald-300">
              Code applied! {applyResult.referrerName ?? "Your friend"} earned a reward.
            </p>
          )}
          {applyResult?.alreadyProcessed && (
            <p className="mt-2 text-xs text-white/50">You already applied a referral code.</p>
          )}
        </section>
      ) : (
        <p className="mt-5 text-center text-xs text-white/35">You&apos;ve already applied a referral code.</p>
      )}

      {/* History */}
      <section className="mt-5">
        <h2 className="mb-3 text-sm font-bold text-white">Invited friends</h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm font-semibold text-white/40">No invites yet</p>
            <p className="mt-1 text-xs text-white/30">Share your code to start earning.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-3.5 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2238] text-sm font-black text-[#E8C27A]">
                  {(entry.referredName ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {entry.referredName ?? "Friend"}
                  </p>
                  <p className="text-xs text-white/40">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-[#E8C27A]">
                  +{formatCoins(entry.rewardCoins)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="h-4 w-4 text-[#E8C27A]" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#0d0a12] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 50% at 50% -10%, rgba(232,194,122,0.10), transparent 60%), radial-gradient(90% 40% at 100% 100%, rgba(168,85,247,0.14), transparent 60%), #0d0a12",
        }}
      />
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-12 pt-4">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Profile
          </Link>
          <h1 className="text-lg font-black tracking-tight text-white">Refer &amp; Earn</h1>
          <span className="w-[72px]" />
        </div>
        {children}
      </div>
    </main>
  );
}
