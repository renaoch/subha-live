"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Landmark,
  Lock,
  ShieldAlert,
  Store,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { tradingApi, type TradingLedgerEntry, type TradingOverview } from "@/lib/api/trading";
import { cn } from "@/lib/utils";
import { BuyCoinsTab } from "./buy-coins-tab";
import { PayHostTab } from "./pay-host-tab";

type Tab = "buy-coins" | "host-transfer";
type Status = "loading" | "unauthorized" | "ready" | "error";

export function TradingCenter() {
  const [status, setStatus] = useState<Status>("loading");
  const [overview, setOverview] = useState<TradingOverview | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<TradingLedgerEntry[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("buy-coins");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const [ov, txns] = await Promise.all([
        tradingApi.overview(),
        tradingApi.transactions(20, 0),
      ]);
      setOverview(ov);
      setBalance(ov.account.availableBalance);
      setTransactions(txns);
      setTransactionsLoading(false);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setStatus("unauthorized");
      } else {
        setStatus("error");
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePaid = useCallback((newBalance: number) => {
    setBalance(newBalance);
    // Refresh the activity feed to include the new payment.
    tradingApi.transactions(20, 0).then(setTransactions).catch(() => {});
  }, []);

  if (status === "loading") {
    return <Shell><LoadingState /></Shell>;
  }

  if (status === "unauthorized") {
    return <Shell><AccessDenied /></Shell>;
  }

  if (status === "error" || !overview) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-white/60">{errorMessage ?? "Could not load the Trading Center."}</p>
          <button onClick={() => void load()} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header / agency identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2A2238] ring-1 ring-[#CBA35C]/30">
          <Landmark className="h-6 w-6 text-[#CBA35C]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black tracking-tight text-white">Agency Trading Center</h1>
          <p className="truncate text-xs font-medium text-white/40">
            {overview.agency.name} · ID: {overview.agency.code}
          </p>
        </div>
      </div>

      {/* Security indicator */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#CBA35C]/15 bg-[#CBA35C]/[0.06] px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-[#CBA35C]" />
        <span className="text-xs font-semibold text-[#E8C27A]">
          Trading account protected · Agency Owner Access
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#1D1829]/60 p-1">
        {(["buy-coins", "host-transfer"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "relative rounded-xl py-2.5 text-sm font-bold transition",
              tab === t ? "text-[#1A1424]" : "text-white/50 hover:text-white/80",
            )}
          >
            {tab === t && (
              <motion.span
                layoutId="trading-tab-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{t === "buy-coins" ? "Buy Coins" : "Host Transfer"}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-5">
        <AnimatePresence mode="wait">
          {tab === "buy-coins" ? (
            <motion.div key="buy-coins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <BuyCoinsTab
                agencyId={overview.agency.id}
                agencyName={overview.agency.name}
                balance={balance}
                transactions={transactions}
                transactionsLoading={transactionsLoading}
              />
            </motion.div>
          ) : (
            <motion.div key="host-transfer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <PayHostTab balance={balance} onPaid={handlePaid} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#0d0a12] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      {/* Layered background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 50% at 50% -10%, rgba(168,85,247,0.16), transparent 60%), radial-gradient(80% 40% at 100% 100%, rgba(203,163,92,0.10), transparent 60%), #0d0a12",
        }}
      />

      <div className="relative mx-auto min-h-dvh w-full max-w-[720px] px-4 pb-12 pt-4">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Profile
        </Link>

        {children}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-14 animate-pulse rounded-2xl bg-[#1D1829]/60" />
      <div className="h-9 animate-pulse rounded-2xl bg-[#1D1829]/60" />
      <div className="h-40 animate-pulse rounded-3xl bg-[#1D1829]/60" />
      <div className="h-64 animate-pulse rounded-3xl bg-[#1D1829]/60" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/30"
      >
        <ShieldAlert className="h-8 w-8 text-rose-300" />
      </motion.div>
      <h1 className="mt-5 text-xl font-black text-white">Agency Owner access required</h1>
      <p className="mt-2 max-w-xs text-sm text-white/45">
        The Agency Trading Center is restricted to active Agency Owners. This area is where agency
        coins are held and host payments are made.
      </p>
      <Link
        href="/profile"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
      >
        <Store className="h-4 w-4" /> Back to profile
      </Link>
    </div>
  );
}
