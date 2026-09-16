"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { financialApi, newClientRequestId, type WithdrawalRecord } from "@/lib/api/financial";
import {
  Diamond,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  Lock,
  History as HistoryIcon,
  Landmark,
} from "lucide-react";

type ApiResponse<T> = { status: string; data: T };
type WalletData = { coins: number; diamonds: number };
type IncomeTab = "withdraw" | "exchange";

// No exchange rate or minimum is defined anywhere on the backend today —
// there's no rate table and fin_request_withdrawal doesn't reject small
// amounts. These are placeholders so the UI isn't silently wrong; confirm
// the real numbers with finance/backend and move them server-side (so the
// server enforces the minimum, not just this screen) before launch.
const DIAMOND_TO_USD_RATE = 0.01; // placeholder: 100 diamonds ≈ $1
const MIN_WITHDRAWAL_DIAMONDS = 100_000; // 1,00,000

export default function DiamondsPage() {
  const [diamonds, setDiamonds] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tab, setTab] = useState<IncomeTab>("withdraw");
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [walletRes, myWithdrawals] = await Promise.all([
        api.get("/api/v1/wallet/me") as Promise<ApiResponse<WalletData>>,
        financialApi.myWithdrawals(),
      ]);
      setDiamonds(walletRes.data.diamonds || 0);
      setWithdrawals(myWithdrawals.filter((w) => w.currency === "diamonds"));
    } catch (err: any) {
      setError(err?.message || "Failed to load your income.");
    } finally {
      setLoading(false);
    }
  }

  const pendingDiamonds = useMemo(
    () => withdrawals.filter((w) => w.status === "pending").reduce((sum, w) => sum + w.amount, 0),
    [withdrawals]
  );

  async function handleWithdraw() {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      setError("Enter how many diamonds you'd like to withdraw.");
      return;
    }
    if (parsed < MIN_WITHDRAWAL_DIAMONDS) {
      setError(`Minimum withdrawal is ${MIN_WITHDRAWAL_DIAMONDS.toLocaleString("en-IN")} diamonds.`);
      return;
    }
    if (!account.trim()) {
      setError(method === "upi" ? "Enter your UPI ID." : "Enter your bank account number.");
      return;
    }
    if (parsed > diamonds) {
      setError("You don't have that many diamonds.");
      return;
    }
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      await financialApi.requestWithdrawal({
        currency: "diamonds",
        amount: parsed,
        [method === "upi" ? "upiId" : "bankAccount"]: account.trim(),
        clientRequestId: newClientRequestId(),
      });
      setSuccess("Withdrawal requested — we'll review it and release funds shortly.");
      setAmount("");
      setAccount("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Withdrawal failed.");
    } finally {
      setProcessing(false);
    }
  }

  const statusMeta = {
    pending: { label: "Pending review", Icon: Clock, cls: "text-[hsl(var(--accent-gold))]" },
    approved: { label: "Approved", Icon: CheckCircle2, cls: "text-[hsl(var(--accent-green))]" },
    rejected: { label: "Rejected", Icon: XCircle, cls: "text-[hsl(var(--live-red))]" },
  } as const;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[hsl(var(--surface))]">
        <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--accent-hot))]" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-Subha-gradient pb-14 text-[hsl(var(--ink))]">
      <div className="mx-auto max-w-lg px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/profile/me"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
            aria-label="Back to profile"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </Link>
          <h1 className="text-base font-bold tracking-tight">My income</h1>
          <a
            href="#history"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
            aria-label="View history"
          >
            <HistoryIcon className="h-4 w-4" />
          </a>
        </div>

        {/* Tabs */}
        <div className="glass-panel mt-5 flex rounded-full p-1">
          <button
            onClick={() => setTab("withdraw")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              tab === "withdraw" ? "grad-brand text-white" : "text-[hsl(var(--ink-faint))]"
            }`}
          >
            Withdraw to cash
          </button>
          <button
            onClick={() => setTab("exchange")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              tab === "exchange" ? "grad-brand text-white" : "text-[hsl(var(--ink-faint))]"
            }`}
          >
            Exchange to coins
          </button>
        </div>

        {/* Total amount */}
        <div className="stage-card noise-overlay glow-hot mt-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[hsl(var(--accent-hot-2))]">
                <Diamond className="h-4 w-4" />
                <span className="text-xs font-semibold text-[hsl(var(--ink-faint))]">Total diamonds</span>
              </div>
              <p className="mt-1.5 text-3xl font-black tabular-nums">{diamonds.toLocaleString()}</p>
            </div>
            {pendingDiamonds > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-semibold text-[hsl(var(--ink-faint))]">Pending review</p>
                <p className="text-sm font-bold text-[hsl(var(--accent-gold))]">
                  {pendingDiamonds.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {tab === "exchange" && (
          <div className="glass-panel mt-4 flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
            <Lock className="h-5 w-5 text-[hsl(var(--ink-faint))]" />
            <p className="text-sm font-bold text-[hsl(var(--ink-muted))]">Coming soon</p>
            <p className="text-xs text-[hsl(var(--ink-faint))]">
              Exchanging diamonds for coins isn't available yet.
            </p>
          </div>
        )}

        {tab === "withdraw" && (
          <>
            <div className="mt-5">
              <p className="text-xs font-semibold text-[hsl(var(--ink-faint))]">Withdrawal method</p>
              <div className="mt-2 flex gap-2">
                {(["upi", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                      method === m
                        ? "border-[hsl(var(--accent-hot))]/60 bg-[hsl(var(--accent-hot))]/15 text-[hsl(var(--accent-hot))]"
                        : "border-white/10 text-[hsl(var(--ink-faint))]"
                    }`}
                  >
                    <Landmark className="h-3.5 w-3.5" /> {m === "upi" ? "UPI" : "Bank"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={method === "upi" ? "UPI ID (e.g. name@upi)" : "Bank account number"}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-[hsl(var(--accent-hot))]"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-[hsl(var(--ink-faint))]">Diamonds to withdraw</p>
                <p className="text-[10.5px] text-[hsl(var(--ink-faint))]">
                  100,000 diamonds ≈ ${(1000 * DIAMOND_TO_USD_RATE).toFixed(2)}
                </p>
              </div>
              <div className="relative mt-2">
                <input
                  type="number"
                  placeholder={`Min. ${MIN_WITHDRAWAL_DIAMONDS.toLocaleString("en-IN")}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 pr-14 text-sm outline-none transition focus:border-[hsl(var(--accent-hot))]"
                />
                <button
                  onClick={() => setAmount(String(diamonds))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[hsl(var(--accent-hot))]"
                >
                  All
                </button>
              </div>
              {Number(amount) > 0 && (
                <p className="mt-1.5 text-[10.5px] text-[hsl(var(--ink-faint))]">
                  You'll receive ≈ ${(Number(amount) * DIAMOND_TO_USD_RATE).toFixed(2)}
                  {Number(amount) < MIN_WITHDRAWAL_DIAMONDS && (
                    <span className="text-[hsl(var(--live-red))]">
                      {" "}
                      · below the {MIN_WITHDRAWAL_DIAMONDS.toLocaleString("en-IN")} minimum
                    </span>
                  )}
                </p>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-[hsl(var(--live-red))]/25 bg-[hsl(var(--live-red))]/10 px-4 py-2.5 text-xs text-[hsl(var(--live-red))]">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[hsl(var(--accent-green))]/25 bg-[hsl(var(--accent-green))]/10 px-4 py-2.5 text-xs text-[hsl(var(--accent-green))]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {success}
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={processing || Number(amount) < MIN_WITHDRAWAL_DIAMONDS}
              className="grad-brand mt-5 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request withdrawal"}
            </button>
            <p className="mt-2 text-center text-[10.5px] text-[hsl(var(--ink-faint))]">
              Minimum {MIN_WITHDRAWAL_DIAMONDS.toLocaleString("en-IN")} diamonds per request · reviewed by our
              team before funds are released, nothing is deducted automatically.
            </p>
          </>
        )}

        {/* History */}
        <div id="history" className="mt-8 scroll-mt-6">
          <h2 className="text-sm font-bold text-[hsl(var(--ink))]">Withdrawal history</h2>
          {withdrawals.length === 0 ? (
            <div className="glass-panel mt-3 rounded-2xl px-6 py-10 text-center text-sm text-[hsl(var(--ink-faint))]">
              <Clock className="mx-auto h-5 w-5 text-[hsl(var(--ink-faint))]" />
              <p className="mt-2">No withdrawals yet.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {withdrawals.map((w) => {
                const meta = statusMeta[w.status];
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-bold text-[hsl(var(--ink))]">
                        {w.amount.toLocaleString()} diamonds
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[hsl(var(--ink-faint))]">
                        {new Date(w.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${meta.cls}`}>
                      <meta.Icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}