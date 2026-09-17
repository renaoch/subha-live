"use client";

/**
 * Agency Owner — Buy Coins
 * -------------------------------------------------------------------------
 * RBAC: visible + usable only to the current agency's owner
 * (currentUser.id === myAgency.ownerId). Everyone else (agents, hosts,
 * pending members, non-members) gets a friendly "owners only" screen.
 *
 * Flow: pick a USD tier -> header + summary auto-update (base coins,
 * commission %, commission coins, total coins) -> pick a payment method
 * (Binance / ePay) -> submit. Submission reuses the existing offline
 * recharge intake endpoint so it lands in the same admin approval queue,
 * tagged with the agency + tier metadata.
 */

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Coins,
  ChevronLeft,
  ShieldAlert,
  Loader2,
  Sparkles,
  Wallet,
  Check,
  Copy,
  ArrowRight,
  Percent,
  Gift,
  Landmark,
} from "lucide-react";

import { useAgency } from "@/hooks/use-agency";
import { usersApi } from "@/lib/api/users";
import { api } from "@/lib/api/client";

/* ============================================================================
 * DATA — official tier / commission table (structure only, no source design)
 * ========================================================================== */

interface Tier {
  usd: number;
  baseCoins: number;
  commissionPct: number;
}

const TIERS: Tier[] = [
  { usd: 200, baseCoins: 1_911_000, commissionPct: 5 },
  { usd: 500, baseCoins: 4_777_500, commissionPct: 10 },
  { usd: 1_000, baseCoins: 9_555_000, commissionPct: 15 },
  { usd: 2_000, baseCoins: 19_110_000, commissionPct: 20 },
  { usd: 5_000, baseCoins: 47_775_000, commissionPct: 25 },
  { usd: 10_000, baseCoins: 95_550_000, commissionPct: 30 },
];

const PAYMENT_METHODS = [
  {
    id: "binance",
    name: "Binance",
    subtitle: "USDT · TRC20 / BEP20",
    icon: Landmark,
    accent: "from-amber-400 to-yellow-500",
  },
  {
    id: "epay",
    name: "ePay",
    subtitle: "Card / bank transfer",
    icon: Wallet,
    accent: "from-sky-400 to-blue-500",
  },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

function formatNumber(n: number) {
  return n.toLocaleString("en-IN");
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

export default function AgencyBuyCoinsPage() {
  const { myAgency, loading: agencyLoading } = useAgency();

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [checkingRole, setCheckingRole] = React.useState(true);
  const [walletCoins, setWalletCoins] = React.useState<number | null>(null);

  const [selectedTier, setSelectedTier] = React.useState<Tier>(TIERS[2]);
  const [method, setMethod] = React.useState<PaymentMethodId | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [txnRef, setTxnRef] = React.useState("");
  const [showTxnStep, setShowTxnStep] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // RBAC: resolve current user
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await usersApi.me();
        if (!cancelled) setCurrentUserId(me.id);
      } catch {
        if (!cancelled) setCurrentUserId(null);
      } finally {
        if (!cancelled) setCheckingRole(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isOwner =
    !!myAgency && !!currentUserId && currentUserId === myAgency.ownerId;

  // Available coins (header)
  React.useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await api.get("/api/v1/wallet/me")) as any;
        const coins = res?.data?.coins ?? res?.coins;
        if (!cancelled && typeof coins === "number") setWalletCoins(coins);
      } catch {
        /* header falls back to "—" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const commissionCoins = Math.round(
    (selectedTier.baseCoins * selectedTier.commissionPct) / 100,
  );
  const totalCoins = selectedTier.baseCoins + commissionCoins;

  const PAY_ADDRESSES: Record<PaymentMethodId, string> = {
    binance: "TXn9k2...Subha7Fun (TRC20)",
    epay: "epay.link/pay/subha-agency",
  };

  async function handleCopy() {
    if (!method) return;
    try {
      await navigator.clipboard.writeText(PAY_ADDRESSES[method]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable — non-fatal */
    }
  }

  async function handleSubmit() {
    if (!method) {
      toast.error("Choose a payment method first.");
      return;
    }
    if (!txnRef.trim()) {
      toast.error("Enter your transaction reference.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/v1/offline-recharge/request", {
        amountUsd: selectedTier.usd,
        paymentMethod: method,
        transactionRef: txnRef.trim(),
        note: `Agency coin purchase · agency=${myAgency?.name ?? "unknown"} · tier=$${selectedTier.usd} · commission=${selectedTier.commissionPct}% · totalCoins=${totalCoins}`,
      });
      toast.success("Purchase submitted!", {
        description: "Your coins will be credited once payment is verified.",
      });
      setShowTxnStep(false);
      setTxnRef("");
      setMethod(null);
    } catch (err: any) {
      toast.error("Could not submit purchase", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* LOADING                                                            */
  /* ------------------------------------------------------------------ */
  if (agencyLoading || checkingRole) {
    return (
      <main className="relative min-h-dvh w-full overflow-hidden bg-[#0b0a14]">
        <AuroraBackground />
        <div className="relative z-10 flex min-h-dvh items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* ACCESS DENIED                                                      */
  /* ------------------------------------------------------------------ */
  if (!isOwner) {
    return (
      <main className="relative min-h-dvh w-full overflow-hidden bg-[#0b0a14]">
        <AuroraBackground />
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/30"
          >
            <ShieldAlert className="h-8 w-8 text-rose-300" />
          </motion.div>
          <h1 className="mt-5 text-xl font-black text-white">
            Agency owners only
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Bulk coin purchases are restricted to the agency owner account.
            {myAgency
              ? " You're a member of this agency, but not its owner."
              : " Join or create an agency first."}
          </p>
          <Link
            href="/agency-center"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Agency Center
          </Link>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* MAIN                                                                */
  /* ------------------------------------------------------------------ */
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#0b0a14] pb-28 text-white">
      <AuroraBackground />

      <div className="relative z-10 mx-auto max-w-[720px] px-4 pt-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/agency-center"
            className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Agency
          </Link>

          <motion.div
            layout
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400/15 to-yellow-500/10 px-4 py-1.5 ring-1 ring-amber-300/20"
          >
            <Coins className="h-4 w-4 text-amber-300" />
            <span className="text-xs font-semibold text-white/50">
              Available
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={walletCoins ?? "loading"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-sm font-black text-amber-300"
              >
                {walletCoins === null ? "—" : formatNumber(walletCoins)}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Header */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Buy Coins</h1>
            <p className="text-xs font-medium text-white/40">
              {myAgency?.name} · Agency owner desk
            </p>
          </div>
        </div>

        {/* Tier picker */}
        <section className="mt-7">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/35">
            <Sparkles className="h-3.5 w-3.5" /> Select amount
          </h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
            {TIERS.map((tier) => {
              const active = tier.usd === selectedTier.usd;
              return (
                <motion.button
                  key={tier.usd}
                  onClick={() => setSelectedTier(tier)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative overflow-hidden rounded-2xl px-3 py-4 text-left ring-1 transition-all ${
                    active
                      ? "bg-gradient-to-br from-amber-400/20 to-orange-500/10 ring-amber-300/50"
                      : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="tier-glow"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <p className="text-lg font-black text-white">
                      ${formatNumber(tier.usd)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      <Percent className="h-3 w-3" /> {tier.commissionPct}% bonus
                    </p>
                  </div>
                  {active && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400"
                    >
                      <Check className="h-3 w-3 text-black" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Live summary */}
        <AnimatePresence mode="wait">
          <motion.section
            key={selectedTier.usd}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="mt-6 overflow-hidden rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-white/35">
                Order summary
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
                ${formatNumber(selectedTier.usd)} USD
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryRow
                icon={<Coins className="h-4 w-4 text-white/40" />}
                label="Base coins"
                value={formatNumber(selectedTier.baseCoins)}
              />
              <SummaryRow
                icon={<Percent className="h-4 w-4 text-amber-300" />}
                label={`Commission (${selectedTier.commissionPct}%)`}
                value={`+ ${formatNumber(commissionCoins)}`}
                valueClass="text-amber-300"
              />
              <div className="h-px bg-white/10" />
              <SummaryRow
                icon={<Gift className="h-4 w-4 text-emerald-300" />}
                label="Total coins credited"
                value={formatNumber(totalCoins)}
                valueClass="text-lg font-black text-emerald-300"
                bold
              />
            </div>
          </motion.section>
        </AnimatePresence>

        {/* Payment method */}
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/35">
            Pay with
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const active = method === pm.id;
              return (
                <motion.button
                  key={pm.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setMethod(pm.id);
                    setShowTxnStep(true);
                  }}
                  className={`flex items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-all ${
                    active
                      ? "bg-white/[0.06] ring-white/25"
                      : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${pm.accent}`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{pm.name}</p>
                    <p className="text-[11px] text-white/35">{pm.subtitle}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Payment details + confirm */}
        <AnimatePresence>
          {showTxnStep && method && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-5 overflow-hidden"
            >
              <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/35">
                  Send ${formatNumber(selectedTier.usd)} to
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2.5">
                  <span className="truncate text-sm font-mono text-white/80">
                    {PAY_ADDRESSES[method]}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/20"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-white/35">
                  Transaction reference
                </label>
                <input
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="Txn hash / receipt ID"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-400/60"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky pay bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0a14]/90 px-4 py-3 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase text-white/30">
              You'll receive
            </p>
            <p className="text-base font-black text-emerald-300">
              {formatNumber(totalCoins)} coins
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={submitting}
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/25 transition disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Pay ${formatNumber(selectedTier.usd)}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}

/* ============================================================================
 * PIECES
 * ========================================================================== */

function SummaryRow({
  icon,
  label,
  value,
  valueClass = "text-white/80",
  bold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-white/50">
        {icon}
        {label}
      </span>
      <span className={`text-sm ${bold ? "" : "font-bold"} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ opacity: [0.25, 0.4, 0.25], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-violet-600/20 blur-[110px]"
      />
      <motion.div
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]"
      />
    </div>
  );
}