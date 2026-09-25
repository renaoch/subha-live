"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Coins,
  Copy,
  Landmark,
  Loader2,
  Percent,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { TransactionList } from "./transaction-list";
import { formatCoins } from "./format";
import type { TradingLedgerEntry } from "@/lib/api/trading";

interface BuyCoinsTabProps {
  agencyId: string;
  agencyName: string;
  balance: number;
  transactions: TradingLedgerEntry[];
  transactionsLoading: boolean;
}

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
  { id: "binance", name: "Binance", subtitle: "USDT · TRC20 / BEP20", icon: Landmark, accent: "from-amber-400 to-yellow-500" },
  { id: "epay", name: "ePay", subtitle: "Card / bank transfer", icon: Wallet, accent: "from-sky-400 to-blue-500" },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

const PAY_ADDRESSES: Record<PaymentMethodId, string> = {
  binance: "TXn9k2...Subha7Fun (TRC20)",
  epay: "epay.link/pay/subha-agency",
};

function formatNumber(n: number) {
  return n.toLocaleString("en-IN");
}

export function BuyCoinsTab({ agencyId, agencyName, balance, transactions, transactionsLoading }: BuyCoinsTabProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>(TIERS[2]);
  const [method, setMethod] = useState<PaymentMethodId | null>(null);
  const [txnRef, setTxnRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const commissionCoins = Math.round((selectedTier.baseCoins * selectedTier.commissionPct) / 100);
  const totalCoins = selectedTier.baseCoins + commissionCoins;

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
        note: `Agency coin purchase · agency=${agencyName} · tier=$${selectedTier.usd} · commission=${selectedTier.commissionPct}% · totalCoins=${totalCoins}`,
        agencyId,
      });
      toast.success("Purchase submitted!", {
        description: "Your Trading Market balance will be credited once payment is verified.",
      });
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

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="relative overflow-hidden rounded-3xl border border-[#2A2238] bg-gradient-to-br from-[#241C33] via-[#1D1829] to-[#17131F] p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#CBA35C]/10 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">Trading Market Balance</p>
        <div className="mt-2 flex items-baseline gap-2">
          <Coins className="h-6 w-6 text-[#CBA35C]" />
          <p className="text-4xl font-black tracking-tight text-white">{formatCoins(balance)}</p>
        </div>
        <p className="text-sm font-semibold text-[#CBA35C]">Coins</p>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          Coins you purchase are transferred to the Trading Market and can be used for host payments.
        </p>
      </div>

      {/* Tier picker */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/35">
          <Coins className="h-3.5 w-3.5" /> Select amount
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {TIERS.map((tier) => {
            const active = tier.usd === selectedTier.usd;
            return (
              <button
                key={tier.usd}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={cn(
                  "relative overflow-hidden rounded-2xl px-3 py-4 text-left ring-1 transition-all",
                  active
                    ? "bg-gradient-to-br from-[#CBA35C]/20 to-orange-500/10 ring-[#CBA35C]/50"
                    : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]",
                )}
              >
                <p className="text-lg font-black text-white">${formatNumber(tier.usd)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#E8C27A]">
                  <Percent className="h-3 w-3" /> {tier.commissionPct}% bonus
                </p>
                {active && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#CBA35C]">
                    <Check className="h-3 w-3 text-black" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white/35">Order summary</span>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
            ${formatNumber(selectedTier.usd)} USD
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          <SummaryRow label="Base coins" value={formatNumber(selectedTier.baseCoins)} />
          <SummaryRow label={`Commission (${selectedTier.commissionPct}%)`} value={`+ ${formatNumber(commissionCoins)}`} valueClass="text-[#E8C27A]" />
          <div className="h-px bg-white/10" />
          <SummaryRow label="Total credited to Trading Market" value={formatNumber(totalCoins)} valueClass="text-lg font-black text-[#E8C27A]" bold />
        </div>
      </div>

      {/* Payment method */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/35">Pay with</h2>
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_METHODS.map((pm) => {
            const Icon = pm.icon;
            const active = method === pm.id;
            return (
              <button
                key={pm.id}
                type="button"
                onClick={() => setMethod(pm.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-all",
                  active ? "bg-white/[0.06] ring-white/25" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]",
                )}
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br", pm.accent)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{pm.name}</p>
                  <p className="text-[11px] text-white/35">{pm.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Payment details */}
      <AnimatePresence>
        {method && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/35">
                Send ${formatNumber(selectedTier.usd)} to
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2.5">
                <span className="truncate text-sm font-mono text-white/80">{PAY_ADDRESSES[method]}</span>
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
                className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#CBA35C]/60"
              />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleSubmit()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B] py-4 text-base font-black text-[#1A1424] shadow-[0_12px_30px_-12px_rgba(203,163,92,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Pay ${formatNumber(selectedTier.usd)}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Recent activity */}
      <TransactionList transactions={transactions} loading={transactionsLoading} />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass = "text-white/80",
  bold,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/50">{label}</span>
      <span className={cn("text-sm", bold ? "" : "font-bold", valueClass)}>{value}</span>
    </div>
  );
}
