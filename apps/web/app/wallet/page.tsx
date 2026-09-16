"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import {
  Coins,
  Diamond,
  Loader2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  ChevronLeft,
  Lock,
  Store,
  History as HistoryIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type Package = {
  id: string;
  coins: number;
  priceUsd: number;
  label: string;
};

// The real shape returned by GET /api/v1/wallet/me — it's the
// financial_ledger, not a legacy "purchase/withdrawal" record, so it has
// no `coins` or `status` field. Every wallet type (coins AND diamonds)
// comes back in one list; this page filters down to coins entries.
type LedgerEntry = {
  id: string;
  wallet_type: "coins" | "diamonds";
  direction: "credit" | "debit";
  amount: number;
  balance_after: number | null;
  reason: string;
  reference_type: string;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  recharge: "Recharge",
  gift_sent: "Gift sent",
  gift_received: "Gift received",
  withdrawal: "Withdrawal",
  admin_adjustment: "Adjustment",
};

function formatReason(reason: string) {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

type WalletData = {
  coins: number;
  diamonds: number;
  history: LedgerEntry[];
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

type ChannelTab = "binance" | "google-play" | "local-pay" | "merchant";

const TABS: { id: ChannelTab; label: string }[] = [
  { id: "binance", label: "Binance" },
  { id: "google-play", label: "Google Play" },
  { id: "local-pay", label: "Local Pay" },
  { id: "merchant", label: "Merchant" },
];

// ─── Component ────────────────────────────────────────────────────
export default function WalletPage() {
  const [balance, setBalance] = useState({ coins: 0, diamonds: 0 });
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tab, setTab] = useState<ChannelTab>("binance");

  // Crypto (Binance) recharge — the only rail actually wired up
  // end-to-end: real deposit address, real on-chain verification against
  // Binance before a single coin is credited.
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
      setTransactions((data.history || []).filter((entry) => entry.wallet_type === "coins"));
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
            href="/home/me"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
            aria-label="Back to profile"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </Link>
          <h1 className="text-base font-bold tracking-tight">Recharge</h1>
          <a
            href="#history"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[hsl(var(--ink-muted))] transition hover:bg-white/5"
            aria-label="View history"
          >
            <HistoryIcon className="h-4 w-4" />
          </a>
        </div>

        {/* Balance hero */}
        <div className="mt-5 flex flex-col items-center py-3 text-center">
          <div className="flex items-center gap-2 text-[hsl(var(--accent-gold))]">
            <Coins className="h-7 w-7" />
            <span className="text-3xl font-black tabular-nums text-[hsl(var(--ink))]">
              {balance.coins.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[hsl(var(--ink-faint))]">Coin balance</p>
          <Link
            href="/wallet/diamonds"
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--accent-hot-2))]"
          >
            <Diamond className="h-3 w-3" /> {balance.diamonds.toLocaleString()} diamonds — view income
          </Link>
        </div>

        {/* Channel tabs */}
        <div className="glass-panel flex rounded-full p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-2 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? "grad-brand text-white"
                  : "text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink-muted))]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "google-play" && (
          <div className="glass-panel mt-4 flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
            <Lock className="h-5 w-5 text-[hsl(var(--ink-faint))]" />
            <p className="text-sm font-bold text-[hsl(var(--ink-muted))]">Coming soon</p>
            <p className="text-xs text-[hsl(var(--ink-faint))]">
              Google Play billing isn't connected yet. Use Binance below in the meantime.
            </p>
          </div>
        )}

        {tab === "local-pay" && (
          <div className="glass-panel mt-4 flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
            <Lock className="h-5 w-5 text-[hsl(var(--ink-faint))]" />
            <p className="text-sm font-bold text-[hsl(var(--ink-muted))]">Coming soon</p>
            <p className="text-xs text-[hsl(var(--ink-faint))]">
              Local Pay isn't live yet. Use Binance below in the meantime.
            </p>
          </div>
        )}

        {tab === "merchant" && (
          <div className="glass-panel mt-4 flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
            <Store className="h-5 w-5 text-[hsl(var(--ink-faint))]" />
            <p className="text-sm font-bold text-[hsl(var(--ink-muted))]">No merchant available right now</p>
            <p className="text-xs text-[hsl(var(--ink-faint))]">Check back later for merchant top-ups near you.</p>
          </div>
        )}

        {tab === "binance" && (
          <>
            {/* One-tap payment method */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-[hsl(var(--ink-faint))]">Payment method</p>
              <div className="stage-card mt-2 flex items-center gap-2.5 border-[hsl(var(--accent-hot))]/50 px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--accent-gold))]/15 text-[hsl(var(--accent-gold))]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-[hsl(var(--ink))]">USDT · Binance</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--accent-green))]">
                  <Check className="h-3 w-3" /> Selected
                </span>
              </div>
            </div>

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
                          confirmed on their side.
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

            {/* Packages */}
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => openCryptoRecharge(pkg)}
                  disabled={cryptoLoading}
                  className="stage-card flex flex-col items-center gap-1.5 p-3.5 transition hover:border-[hsl(var(--accent-hot))]/40 active:scale-[0.97] disabled:opacity-50"
                >
                  <Coins className="h-5 w-5 text-[hsl(var(--accent-gold))]" />
                  <span className="text-sm font-black tabular-nums text-[hsl(var(--ink))]">
                    {pkg.coins.toLocaleString()}
                  </span>
                  <span className="grad-brand w-full rounded-lg py-1.5 text-center text-xs font-bold text-white">
                    ${pkg.priceUsd.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Transaction History */}
        <div id="history" className="mt-7 scroll-mt-6">
          <h2 className="text-sm font-bold text-[hsl(var(--ink))]">History</h2>
          {transactions.length === 0 ? (
            <div className="glass-panel mt-3 rounded-2xl px-6 py-10 text-center text-sm text-[hsl(var(--ink-faint))]">
              <Clock className="mx-auto h-5 w-5 text-[hsl(var(--ink-faint))]" />
              <p className="mt-2">No transactions yet.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {transactions.map((tx) => {
                const isCredit = tx.direction === "credit";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-bold text-[hsl(var(--ink))]">
                        {isCredit ? "+" : "−"}
                        {tx.amount.toLocaleString()} coins
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[hsl(var(--ink-faint))]">
                        {formatReason(tx.reason)} · {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCredit ? "text-[hsl(var(--accent-green))]" : "text-[hsl(var(--ink-faint))]"
                      }`}
                    >
                      {isCredit ? "Credit" : "Debit"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-7 text-center text-[10.5px] text-[hsl(var(--ink-faint))]">
          If you encounter any problems with recharging, please{" "}
          <a href="/support" className="text-[hsl(var(--accent-hot))] underline">
            contact support
          </a>
          .
        </p>
      </div>
    </main>
  );
}