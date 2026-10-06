"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Landmark,
  Loader2,
  Percent,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  tradingApi,
  type CoinOrder,
  type CoinOrderNetwork,
  type TradingLedgerEntry,
} from "@/lib/api/trading";
import { cn } from "@/lib/utils";
import { TransactionList } from "./transaction-list";
import { formatCoins } from "./format";

interface BuyCoinsTabProps {
  balance: number;
  transactions: TradingLedgerEntry[];
  transactionsLoading: boolean;
  /** Called with the new Trading Market balance once an order is auto-credited. */
  onCredited: (newBalance: number) => void;
}

// Display-only mirror of the server tier table. The server re-prices every
// order from its own table; nothing here is trusted for money.
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

const NETWORKS: { id: CoinOrderNetwork; name: string; subtitle: string }[] = [
  { id: "TRC20", name: "USDT · TRC20", subtitle: "Tron network" },
  { id: "BEP20", name: "USDT · BEP20", subtitle: "BNB Smart Chain" },
];

const POLL_MS = 8_000;

function formatNumber(n: number) {
  return n.toLocaleString("en-IN");
}

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message || fallback : fallback;
}

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Date.parse(expiresAt) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { expired: !!expiresAt && left === 0, label: `${m}:${String(s).padStart(2, "0")}` };
}

export function BuyCoinsTab({ balance, transactions, transactionsLoading, onCredited }: BuyCoinsTabProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>(TIERS[2]);
  const [network, setNetwork] = useState<CoinOrderNetwork>("TRC20");
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<CoinOrder | null>(null);

  const commissionCoins = Math.round((selectedTier.baseCoins * selectedTier.commissionPct) / 100);
  const totalCoins = selectedTier.baseCoins + commissionCoins;

  // Resume an unpaid order after a refresh / tab switch.
  useEffect(() => {
    let cancelled = false;
    tradingApi
      .coinOrders()
      .then((orders) => {
        if (cancelled) return;
        const live = orders.find((o) => o.status === "pending" && Date.parse(o.expiresAt) > Date.now());
        if (live) setOrder(live);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await tradingApi.createCoinOrder({ tierUsd: selectedTier.usd, network });
      setOrder(created);
    } catch (err) {
      toast.error("Could not start payment", { description: errMsg(err, "Please try again.") });
    } finally {
      setCreating(false);
    }
  }

  const handleDone = useCallback(
    (newBalance: number) => {
      onCredited(newBalance);
    },
    [onCredited],
  );

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
          Coins you purchase are credited here automatically once your payment is confirmed on Binance.
        </p>
      </div>

      {order ? (
        <OrderPanel
          order={order}
          onUpdate={setOrder}
          onCredited={handleDone}
          onReset={() => setOrder(null)}
        />
      ) : (
        <>
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
                ${formatNumber(selectedTier.usd)} USDT
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              <SummaryRow label="Base coins" value={formatNumber(selectedTier.baseCoins)} />
              <SummaryRow
                label={`Commission (${selectedTier.commissionPct}%)`}
                value={`+ ${formatNumber(commissionCoins)}`}
                valueClass="text-[#E8C27A]"
              />
              <div className="h-px bg-white/10" />
              <SummaryRow
                label="Total credited to Trading Market"
                value={formatNumber(totalCoins)}
                valueClass="text-lg font-black text-[#E8C27A]"
                bold
              />
            </div>
          </div>

          {/* Network */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/35">Pay with</h2>
            <div className="grid grid-cols-2 gap-3">
              {NETWORKS.map((n) => {
                const active = network === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetwork(n.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-all",
                      active ? "bg-white/[0.06] ring-white/25" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500">
                      <Landmark className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{n.name}</p>
                      <p className="text-[11px] text-white/35">{n.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B] py-4 text-base font-black text-[#1A1424] shadow-[0_12px_30px_-12px_rgba(203,163,92,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Pay ${formatNumber(selectedTier.usd)}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </>
      )}

      <TransactionList transactions={transactions} loading={transactionsLoading} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function OrderPanel({
  order,
  onUpdate,
  onCredited,
  onReset,
}: {
  order: CoinOrder;
  onUpdate: (o: CoinOrder) => void;
  onCredited: (newBalance: number) => void;
  onReset: () => void;
}) {
  const { expired, label } = useCountdown(order.status === "pending" ? order.expiresAt : null);
  const [copied, setCopied] = useState<"amount" | "address" | null>(null);
  const [txId, setTxId] = useState("");
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inFlight = useRef(false);
  const doneRef = useRef(false);

  const check = useCallback(
    async (manualTx?: string) => {
      if (inFlight.current || doneRef.current) return;
      inFlight.current = true;
      if (manualTx) setChecking(true);
      try {
        const r = await tradingApi.verifyCoinOrder(order.id, manualTx);
        if (r.status === "completed") {
          doneRef.current = true;
          onUpdate(r.order);
          if (typeof r.newBalance === "number") onCredited(r.newBalance);
          toast.success("Payment confirmed", { description: "Coins were added to your Trading Market." });
        } else {
          if (r.status === "expired") onUpdate(r.order);
          setHint(manualTx ? r.message ?? null : null);
        }
      } catch (err) {
        if (manualTx) toast.error("Verification failed", { description: errMsg(err, "Please try again.") });
      } finally {
        inFlight.current = false;
        setChecking(false);
      }
    },
    [order.id, onUpdate, onCredited],
  );

  // Automatic detection: poll while the order is open and the tab is visible.
  useEffect(() => {
    if (order.status !== "pending" || expired) return;
    void check();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [order.status, expired, check]);

  async function copy(kind: "amount" | "address", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  }

  if (order.status === "completed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl bg-emerald-500/10 p-6 text-center ring-1 ring-emerald-400/30"
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <p className="mt-3 text-lg font-black text-white">Payment confirmed</p>
        <p className="mt-1 text-sm text-white/60">
          {formatNumber(order.totalCoins)} coins were added to your Trading Market.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15"
        >
          Buy more
        </button>
      </motion.div>
    );
  }

  if (order.status === "expired" || expired) {
    return (
      <div className="rounded-3xl bg-white/[0.03] p-6 text-center ring-1 ring-white/10">
        <Clock className="mx-auto h-10 w-10 text-white/40" />
        <p className="mt-3 text-base font-black text-white">This payment window has closed</p>
        <p className="mt-1 text-sm text-white/50">
          If you already sent the exact amount, it will still be credited automatically. Otherwise start a new order.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B] px-5 py-2.5 text-sm font-black text-[#1A1424]"
        >
          New order
        </button>
      </div>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white/35">
            Send exactly · {order.coin} {order.networkLabel}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-white/60">
            <Clock className="h-3 w-3" /> {label}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-3">
          <span className="font-mono text-2xl font-black text-[#E8C27A]">{order.payAmount}</span>
          <CopyButton done={copied === "amount"} onClick={() => void copy("amount", order.payAmount)} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/80">
          The cents are what identify your order — the amount must match exactly, and the recipient must receive it in
          full (add network fees on top).
        </p>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-white/35">To address</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2.5">
          <span className="break-all font-mono text-xs text-white/80">{order.depositAddress}</span>
          <CopyButton done={copied === "address"} onClick={() => void copy("address", order.depositAddress)} />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#CBA35C]/10 px-3 py-2.5">
          <span className="text-xs text-white/60">You will receive</span>
          <span className="text-sm font-black text-[#E8C27A]">{formatNumber(order.totalCoins)} coins</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#CBA35C]" />
        <p className="text-xs text-white/60">
          Waiting for your payment. This page updates automatically — no need to submit anything.
        </p>
      </div>

      <details className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/10">
        <summary className="cursor-pointer text-xs font-bold text-white/50">Already paid? Check with transaction ID</summary>
        <div className="mt-3 flex gap-2">
          <input
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="Transaction hash (TxID)"
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#CBA35C]/60"
          />
          <button
            type="button"
            disabled={checking || txId.trim().length < 8}
            onClick={() => void check(txId.trim())}
            className="flex h-11 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </button>
        </div>
        {hint && <p className="mt-2 text-xs text-amber-300/80">{hint}</p>}
      </details>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/30">
        <ShieldCheck className="h-3.5 w-3.5" /> Verified directly against Binance. Coins are never credited from a
        typed amount.
      </p>
    </motion.section>
  );
}

function CopyButton({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/20"
    >
      {done ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
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