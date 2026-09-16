"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  Coins,
  Diamond,
  ArrowUpRight,
  ArrowDownToLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  ChevronLeft,
  Lock,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type Package = {
  id: string;
  coins: number;
  priceUsd: number;
  label: string;
};

type Transaction = {
  id: string;
  type: "purchase" | "withdrawal" | "bonus";
  amount: number;
  coins: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  created_at: string;
};

type WalletData = {
  coins: number;
  diamonds: number;
  history: Transaction[];
  packages: Package[];
};

type ApiResponse<T> = {
  status: string;
  data: T;
};

type CryptoQuote = {
  packageId: string;
  coins: number;
  usdtAmount: number;
  asset: string;
  network: string;
  depositAddress: string;
  depositTag?: string;
};

// ─── Component ────────────────────────────────────────────────────
export default function WalletPage() {
  const [balance, setBalance] = useState({ coins: 0, diamonds: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"bank" | "upi">("upi");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Crypto (Binance) recharge — the only recharge rail that is actually
  // wired up end-to-end (real deposit address, real on-chain
  // verification against Binance before a single coin is credited).
  const [cryptoPkg, setCryptoPkg] = useState<Package | null>(null);
  const [cryptoQuote, setCryptoQuote] = useState<CryptoQuote | null>(null);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoTxId, setCryptoTxId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    try {
      setLoading(true);
      const response = (await api.get("/api/v1/wallet/me")) as ApiResponse<WalletData>;
      const { data } = response;
      setBalance({ coins: data.coins || 0, diamonds: data.diamonds || 0 });
      setTransactions(data.history || []);
      setPackages(data.packages || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function openCryptoRecharge(pkg: Package) {
    try {
      setCryptoPkg(pkg);
      setCryptoQuote(null);
      setCryptoTxId("");
      setError(null);
      setCryptoLoading(true);
      const response = (await api.get(
        `/api/v1/wallet/crypto/quote/${pkg.id}`
      )) as ApiResponse<CryptoQuote>;
      setCryptoQuote(response.data);
    } catch (err: any) {
      setError(err?.message || "Could not load deposit details.");
      setCryptoPkg(null);
    } finally {
      setCryptoLoading(false);
    }
  }

  async function handleVerifyCrypto() {
    if (!cryptoPkg || !cryptoTxId.trim()) {
      setError("Paste the transaction ID / hash from your send.");
      return;
    }
    try {
      setVerifying(true);
      setError(null);
      setSuccess(null);
      await api.post("/api/v1/wallet/crypto/verify", {
        packageId: cryptoPkg.id,
        txId: cryptoTxId.trim(),
      });
      setSuccess(`Confirmed — ${cryptoPkg.coins.toLocaleString()} coins credited.`);
      setCryptoPkg(null);
      setCryptoQuote(null);
      setCryptoTxId("");
      await loadWallet();
    } catch (err: any) {
      setError(
        err?.message ||
          "Couldn't verify that transaction yet — it may still be confirming on-chain. Try again in a minute."
      );
    } finally {
      setVerifying(false);
    }
  }

  function copyAddress() {
    if (!cryptoQuote) return;
    navigator.clipboard.writeText(cryptoQuote.depositAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleWithdraw() {
    if (!withdrawAmount || !withdrawAccount) {
      setError("Please fill in every field.");
      return;
    }
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      await api.post("/api/v1/wallet/withdraw", {
        amount: parseFloat(withdrawAmount),
        [withdrawMethod === "upi" ? "upiId" : "bankAccount"]: withdrawAccount,
      });
      setSuccess("Withdrawal request submitted.");
      setWithdrawAmount("");
      setWithdrawAccount("");
      setShowWithdraw(false);
      await loadWallet();
    } catch (err: any) {
      setError(err?.message || "Withdrawal failed.");
    } finally {
      setProcessing(false);
    }
  }

  const statusMeta = {
    completed: { label: "Completed", Icon: CheckCircle2, cls: "text-[hsl(var(--accent-green))]" },
    pending: { label: "Pending", Icon: Clock, cls: "text-[hsl(var(--accent-gold))]" },
    failed: { label: "Failed", Icon: XCircle, cls: "text-[hsl(var(--live-red))]" },
    cancelled: { label: "Cancelled", Icon: XCircle, cls: "text-[hsl(var(--live-red))]" },
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
          <a
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
            aria-label="Back to profile"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </a>
          <h1 className="text-base font-bold tracking-tight">Wallet</h1>
          <button
            onClick={() => setShowWithdraw((v) => !v)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
          >
            {showWithdraw ? "Cancel" : "Withdraw"}
          </button>
        </div>

        {/* Balance hero */}
        <div className="stage-card noise-overlay glow-hot mt-5 p-5">
          <p className="text-xs font-medium text-[hsl(var(--ink-faint))]">Total balance</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-1.5 text-[hsl(var(--accent-gold))]">
                <Coins className="h-4 w-4" />
                <span className="text-[11px] font-semibold text-[hsl(var(--ink-faint))]">Coins</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {balance.coins.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-1.5 text-[hsl(var(--accent-hot-2))]">
                <Diamond className="h-4 w-4" />
                <span className="text-[11px] font-semibold text-[hsl(var(--ink-faint))]">Diamonds</span>
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {balance.diamonds.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="glass-panel mt-4 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <ArrowDownToLine className="h-4 w-4 text-[hsl(var(--ink-muted))]" />
              Withdraw
            </h3>
            <div className="mt-3 space-y-3">
              <input
                type="number"
                placeholder="Amount (USD)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-[hsl(var(--accent-hot))]"
              />
              <div className="flex gap-2">
                {(["upi", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setWithdrawMethod(m)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      withdrawMethod === m
                        ? "border-[hsl(var(--accent-hot))]/60 bg-[hsl(var(--accent-hot))]/15 text-[hsl(var(--accent-hot))]"
                        : "border-white/10 text-[hsl(var(--ink-faint))]"
                    }`}
                  >
                    {m === "upi" ? "UPI" : "Bank"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={withdrawMethod === "upi" ? "UPI ID (e.g. name@upi)" : "Bank account number"}
                value={withdrawAccount}
                onChange={(e) => setWithdrawAccount(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-[hsl(var(--accent-hot))]"
              />
              <button
                onClick={handleWithdraw}
                disabled={processing}
                className="grad-brand flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request withdrawal"}
              </button>
            </div>
          </div>
        )}

        {/* Crypto recharge panel */}
        {cryptoPkg && (
          <div className="glass-panel mt-4 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Pay with USDT</h3>
              <button
                onClick={() => {
                  setCryptoPkg(null);
                  setCryptoQuote(null);
                }}
                className="text-xs text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink-muted))]"
              >
                Cancel
              </button>
            </div>

            {cryptoLoading || !cryptoQuote ? (
              <div className="mt-5 flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--accent-hot))]" />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <span className="rank-pill mt-0.5 shrink-0 bg-[hsl(var(--accent-hot))]/20 text-[hsl(var(--accent-hot))]">1</span>
                  <div className="text-xs text-[hsl(var(--ink-muted))]">
                    Send exactly{" "}
                    <span className="font-bold text-[hsl(var(--ink))]">
                      {cryptoQuote.usdtAmount.toFixed(2)} {cryptoQuote.asset}
                    </span>{" "}
                    on the <span className="font-bold text-[hsl(var(--ink))]">{cryptoQuote.network}</span> network
                    for {cryptoQuote.coins.toLocaleString()} coins.
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <span className="rank-pill mt-0.5 shrink-0 bg-[hsl(var(--accent-hot))]/20 text-[hsl(var(--accent-hot))]">2</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                      <span className="flex-1 truncate font-mono text-xs text-[hsl(var(--ink-muted))]">
                        {cryptoQuote.depositAddress}
                      </span>
                      <button
                        onClick={copyAddress}
                        className="shrink-0 rounded-lg border border-white/10 p-1.5 text-[hsl(var(--ink-faint))] transition hover:bg-white/5"
                        aria-label="Copy deposit address"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-[hsl(var(--accent-green))]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    {cryptoQuote.depositTag && (
                      <p className="text-xs text-[hsl(var(--accent-gold))]">
                        Memo / tag required: <span className="font-mono">{cryptoQuote.depositTag}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-[hsl(var(--ink-faint))]">
                      Only send from a wallet or exchange account you control.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <span className="rank-pill mt-0.5 shrink-0 bg-[hsl(var(--accent-hot))]/20 text-[hsl(var(--accent-hot))]">3</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="Transaction ID / hash"
                      value={cryptoTxId}
                      onChange={(e) => setCryptoTxId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 font-mono text-xs outline-none transition focus:border-[hsl(var(--accent-hot))]"
                    />
                    <button
                      onClick={handleVerifyCrypto}
                      disabled={verifying}
                      className="grad-brand flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Verify & credit coins
                        </>
                      )}
                    </button>
                    <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-[hsl(var(--ink-faint))]">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      We check this transaction directly against Binance's own deposit
                      record — coins are only credited once the amount and network are
                      confirmed on their side, never on the strength of what's typed here.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error / Success */}
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

        {/* Recharge packages */}
        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-[hsl(var(--ink))]">Add coins</h2>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--ink-faint))]">
              <ShieldCheck className="h-3 w-3" /> Verified on-chain
            </span>
          </div>
          <div className="mt-3 grid gap-2.5">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => openCryptoRecharge(pkg)}
                disabled={cryptoLoading}
                className="stage-card flex items-center justify-between p-4 text-left transition hover:border-[hsl(var(--accent-hot))]/40 active:scale-[0.99] disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-bold text-[hsl(var(--ink))]">{pkg.label}</p>
                  <p className="text-xs text-[hsl(var(--ink-faint))]">
                    ${pkg.priceUsd.toFixed(2)} · pay with USDT
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-bold text-[hsl(var(--accent-hot))]">
                  Recharge <ArrowUpRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>

          {/* Honest state for the rail that isn't live yet, instead of a
              button that silently hands out free coins with no payment
              behind it. */}
          <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-dashed border-white/10 px-4 py-3.5 opacity-60">
            <div>
              <p className="text-sm font-bold text-[hsl(var(--ink-muted))]">Card & UPI</p>
              <p className="text-xs text-[hsl(var(--ink-faint))]">Coming soon</p>
            </div>
            <Lock className="h-4 w-4 text-[hsl(var(--ink-faint))]" />
          </div>
        </div>

        {/* Transaction History */}
        <div className="mt-7">
          <h2 className="text-sm font-bold text-[hsl(var(--ink))]">History</h2>
          {transactions.length === 0 ? (
            <div className="glass-panel mt-3 rounded-2xl px-6 py-10 text-center text-sm text-[hsl(var(--ink-faint))]">
              <Clock className="mx-auto h-5 w-5 text-[hsl(var(--ink-faint))]" />
              <p className="mt-2">No transactions yet.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {transactions.map((tx) => {
                const meta = statusMeta[tx.status];
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-bold text-[hsl(var(--ink))]">
                        {tx.type === "purchase" ? "+" : "−"}
                        {tx.coins.toLocaleString()} coins
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[hsl(var(--ink-faint))]">
                        {new Date(tx.created_at).toLocaleDateString()}
                        {tx.type === "withdrawal" && ` · $${tx.amount.toFixed(2)}`}
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

        <p className="mt-7 text-center text-[10.5px] text-[hsl(var(--ink-faint))]">
          Coins are virtual currency with no cash value outside the platform.
        </p>
      </div>
    </main>
  );
}