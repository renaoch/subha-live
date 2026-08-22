"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { Coins, Diamond, Zap, ArrowUpRight, Wallet, CreditCard, History, Loader2, Plus, Minus, CheckCircle, XCircle, Clock } from "lucide-react";

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

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    try {
      setLoading(true);
      const { data } = await api.get("/api/v1/wallet/me");
      setBalance({ coins: data.coins || 0, diamonds: data.diamonds || 0 });
      setTransactions(data.history || []);
      setPackages(data.packages || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(pkg: Package) {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      await api.post("/api/v1/wallet/purchase", { packageId: pkg.id });
      setSuccess(`Purchased ${pkg.coins} coins!`);
      await loadWallet();
    } catch (err: any) {
      setError(err?.message || "Purchase failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount || !withdrawAccount) {
      setError("Please fill all fields.");
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
      setSuccess("Withdrawal request submitted!");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="h-3 w-3" /> Completed</span>;
      case "pending":
        return <span className="flex items-center gap-1 text-amber-400"><Clock className="h-3 w-3" /> Pending</span>;
      case "failed":
      case "cancelled":
        return <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3 w-3" /> {status}</span>;
      default:
        return <span>{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#17131F] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-[#17131F] px-4 py-6 text-[#F3ECE0]">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h1 className="text-2xl font-black tracking-tight">Wallet</h1>
          <button
            onClick={() => setShowWithdraw(!showWithdraw)}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/5"
          >
            {showWithdraw ? "Cancel" : "Withdraw"}
          </button>
        </div>

        {/* Balance */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-violet-600/5 p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Coins className="h-5 w-5" />
              <span className="text-xs font-bold uppercase">Coins</span>
            </div>
            <p className="mt-2 text-3xl font-black">{balance.coins.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/20 to-amber-600/5 p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Diamond className="h-5 w-5" />
              <span className="text-xs font-bold uppercase">Diamonds</span>
            </div>
            <p className="mt-2 text-3xl font-black">{balance.diamonds.toLocaleString()}</p>
          </div>
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-bold">Withdraw Coins</h3>
            <div className="mt-3 space-y-3">
              <input
                type="number"
                placeholder="Amount (USD)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-violet-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setWithdrawMethod("upi")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                    withdrawMethod === "upi"
                      ? "border-violet-400 bg-violet-500/20 text-violet-300"
                      : "border-white/10 text-white/30"
                  }`}
                >
                  UPI
                </button>
                <button
                  onClick={() => setWithdrawMethod("bank")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                    withdrawMethod === "bank"
                      ? "border-violet-400 bg-violet-500/20 text-violet-300"
                      : "border-white/10 text-white/30"
                  }`}
                >
                  Bank
                </button>
              </div>
              <input
                type="text"
                placeholder={withdrawMethod === "upi" ? "UPI ID (e.g., user@upi)" : "Bank Account Number"}
                value={withdrawAccount}
                onChange={(e) => setWithdrawAccount(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-violet-400"
              />
              <button
                onClick={handleWithdraw}
                disabled={processing}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-500 font-bold transition hover:bg-violet-400 disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Withdrawal"}
              </button>
            </div>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            {success}
          </div>
        )}

        {/* Coin Packages */}
        <div className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wide text-white/30">Buy Coins</h2>
          <div className="mt-3 grid gap-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={processing}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-violet-400 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="font-bold">{pkg.label}</p>
                    <p className="text-xs text-white/30">${pkg.priceUsd.toFixed(2)}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-sm font-bold text-violet-300">
                  Buy <ArrowUpRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wide text-white/30">History</h2>
          {transactions.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-white/30">
              <History className="mx-auto h-6 w-6 text-white/15" />
              <p className="mt-2">No transactions yet.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div>
                    <p className="font-bold text-white">
                      {tx.type === "purchase" ? "+" : ""}
                      {tx.coins} coins
                    </p>
                    <p className="text-[10px] text-white/30">
                      {new Date(tx.created_at).toLocaleDateString()}
                      {tx.type === "withdrawal" && ` · $${tx.amount.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="text-xs">{getStatusBadge(tx.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-white/15">
          Coins are virtual currency. No real-money value outside the platform.
        </p>
      </div>
    </main>
  );
}