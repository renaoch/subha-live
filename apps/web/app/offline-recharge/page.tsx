"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { Coins, Loader2, Wallet, Clock, CheckCircle, XCircle } from "lucide-react";

type RechargeRequest = {
  id: string;
  amount_usd: number;
  payment_method: string;
  transaction_ref: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type ApiResponse<T> = {
  status: string;
  data: T;
};

export default function OfflineRechargePage() {
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [amountUsd, setAmountUsd] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      // Type the response properly
      const response = (await api.get(
        "/api/v1/offline-recharge/my-requests"
      )) as ApiResponse<RechargeRequest[]>;
      setRequests(response.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load your recharge history.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountUsd || !paymentMethod || !transactionRef) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(false);

      await api.post("/api/v1/offline-recharge/request", {
        amountUsd: parseFloat(amountUsd),
        paymentMethod,
        transactionRef,
        note: note || undefined,
      });

      setSuccess(true);
      setAmountUsd("");
      setPaymentMethod("");
      setTransactionRef("");
      setNote("");
      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-1 text-[10px] font-bold text-red-300">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <main className="min-h-dvh bg-[#17131F] px-4 py-6 text-[#F3ECE0]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Wallet className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-black tracking-tight">Offline Recharge</h1>
        </div>

        <p className="mt-3 text-sm text-white/40">
          Submit your offline payment details. Once verified, your coins will be added.
        </p>

        {/* Request Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm"
        >
          <div>
            <label className="block text-xs font-bold uppercase text-white/30">
              Amount (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="10.00"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-white/30">
              Payment Method *
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Bank Transfer, UPI, Crypto"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-white/30">
              Transaction Reference *
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="Transaction ID or Receipt Number"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-white/30">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra info"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
              ✅ Request submitted! We'll process it shortly.
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting || !amountUsd || !paymentMethod || !transactionRef
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>

        {/* History */}
        <div className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wide text-white/30">
            Your Requests
          </h2>
          {loading ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/5" />
          ) : requests.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-white/30">
              No recharge requests yet.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div>
                    <p className="font-bold text-white">
                      ${req.amount_usd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {req.payment_method} ·{" "}
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                    {req.note && (
                      <p className="mt-0.5 text-[10px] text-white/20">
                        📝 {req.note}
                      </p>
                    )}
                  </div>
                  <div>{getStatusBadge(req.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-white/15">
          Requests are processed within 24 hours. Contact support for urgent issues.
        </p>
      </div>
    </main>
  );
}