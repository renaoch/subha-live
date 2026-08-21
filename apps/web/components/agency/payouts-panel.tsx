// File: apps/web/components/agency/payouts-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { agencyApi, type Payout } from "@/lib/api/agency";

interface PayoutsPanelProps {
  agencyId: string;
}

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-amber-400/[0.08] text-amber-300/70",
  under_review: "bg-amber-400/[0.08] text-amber-300/70",
  approved: "bg-sky-400/[0.08] text-sky-300/70",
  processing: "bg-sky-400/[0.08] text-sky-300/70",
  paid: "bg-emerald-400/[0.08] text-emerald-300/70",
  rejected: "bg-red-400/[0.08] text-red-300/70",
  failed: "bg-red-400/[0.08] text-red-300/70",
  cancelled: "bg-white/[0.05] text-white/30",
};

export function PayoutsPanel({ agencyId }: PayoutsPanelProps) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPayouts(await agencyApi.payouts(agencyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!amount) return;

    try {
      setSubmitting(true);
      setError(null);
      await agencyApi.requestPayout(agencyId, Number(amount), note.trim() || undefined);
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request payout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <form
        onSubmit={handleRequest}
        className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#15111B] p-4 sm:flex-row sm:items-center"
      >
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          min={0}
          step="0.01"
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40 sm:w-40"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#A855F7]/40"
        />
        <button
          type="submit"
          disabled={submitting || !amount}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#A855F7] px-4 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wallet className="h-3.5 w-3.5" />
          Request Payout
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ) : payouts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center text-xs text-white/30">
          No payout requests yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#15111B] p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-white">₹{payout.amount.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  Requested {new Date(payout.requestedAt).toLocaleDateString()}
                  {payout.note ? ` · ${payout.note}` : ""}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                  STATUS_STYLES[payout.status] ?? STATUS_STYLES.requested
                }`}
              >
                {payout.status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}