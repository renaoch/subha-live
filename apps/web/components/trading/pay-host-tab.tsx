"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Loader2,
  Search,
  ShieldCheck,
  UserSearch,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { tradingApi, newClientRequestId, type HostPaymentResult, type HostVerification } from "@/lib/api/trading";
import { cn } from "@/lib/utils";
import { HostCard } from "./host-card";
import { formatCoins } from "./format";

interface PayHostTabProps {
  balance: number;
  onPaid: (newBalance: number) => void;
}

type Step = "enter" | "confirm" | "processing" | "success";

export function PayHostTab({ balance, onPaid }: PayHostTabProps) {
  const [hostId, setHostId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedHost, setVerifiedHost] = useState<HostVerification | null>(null);

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("enter");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [result, setResult] = useState<HostPaymentResult | null>(null);

  // One idempotency key per logical payment; reused on retry, cleared on
  // a definitive server answer (success or 4xx).
  const idempotencyKeyRef = useRef<string | null>(null);

  async function handleVerify() {
    const id = hostId.trim();
    if (!id) return;
    setVerifying(true);
    setVerifyError(null);
    setVerifiedHost(null);
    try {
      const host = await tradingApi.verifyHost(id);
      setVerifiedHost(host);
      setAmount("");
      setPayError(null);
      setStep("enter");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not verify host. Please try again.";
      setVerifyError(code === "HOST_NOT_FOUND" ? "Host not found" : message);
      setVerifiedHost(null);
    } finally {
      setVerifying(false);
    }
  }

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isInteger(parsedAmount) && parsedAmount > 0;
  const overBalance = isValidAmount && parsedAmount > balance;
  const remainingAfter = isValidAmount ? balance - parsedAmount : balance;
  const canConfirm = isValidAmount && !overBalance && !!verifiedHost?.eligible;

  function openConfirm() {
    if (!canConfirm) return;
    setPayError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!verifiedHost || !isValidAmount || overBalance) return;
    const key = idempotencyKeyRef.current ?? newClientRequestId();
    idempotencyKeyRef.current = key;

    setSubmitting(true);
    setPayError(null);
    setStep("processing");
    try {
      const res = await tradingApi.payHost({
        hostId: verifiedHost.publicId ?? verifiedHost.handle,
        amount: parsedAmount,
        idempotencyKey: key,
      });
      idempotencyKeyRef.current = null;
      setResult(res);
      onPaid(res.newBalance);
      setStep("success");
    } catch (err) {
      const retryable = !(err instanceof ApiError) || err.status >= 500;
      if (retryable) {
        // Keep the key for an idempotent retry.
      } else {
        idempotencyKeyRef.current = null;
      }
      setPayError(err instanceof ApiError ? err.message : "Payment failed. Please retry.");
      setStep("confirm");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setVerifiedHost(null);
    setHostId("");
    setAmount("");
    setResult(null);
    setPayError(null);
    setVerifyError(null);
    setStep("enter");
  }

  if (step === "success" && result && verifiedHost) {
    return (
      <SuccessPanel
        host={verifiedHost}
        result={result}
        onDone={reset}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1 — enter host ID */}
      <section>
        <label htmlFor="host-id" className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/40">
          User ID
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              id="host-id"
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleVerify();
              }}
              placeholder="Enter user ID"
              disabled={verifying}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#CBA35C]/60 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={!hostId.trim() || verifying}
            className="flex h-12 items-center gap-1.5 rounded-xl bg-[#CBA35C] px-4 text-sm font-bold text-[#1A1424] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </button>
        </div>

        {verifyError && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-300">
            <X className="h-4 w-4" /> {verifyError}
          </p>
        )}
      </section>

      {/* Verified host card */}
      <AnimatePresence>
        {verifiedHost && (
          <HostCard host={verifiedHost} onClear={() => setVerifiedHost(null)} />
        )}
      </AnimatePresence>

      {/* Amount */}
      {verifiedHost?.eligible && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4"
        >
          <label htmlFor="payment-amount" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">
            Payment Amount
          </label>
          <div className="flex items-center gap-2">
            <input
              id="payment-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-lg font-bold text-white outline-none placeholder:text-white/25 focus:border-[#CBA35C]/60"
            />
            <span className="shrink-0 text-sm font-semibold text-white/50">Coins</span>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <Row label="Available" value={`${formatCoins(balance)} Coins`} />
            <Row label="Maximum payment" value={`${formatCoins(balance)} Coins`} />
            <Row
              label="Remaining after payment"
              value={`${formatCoins(Math.max(0, remainingAfter))} Coins`}
              muted={overBalance}
            />
          </div>

          {overBalance && (
            <p className="mt-2 text-sm font-semibold text-rose-300">
              Amount exceeds your available trading balance.
            </p>
          )}
        </motion.section>
      )}

      {verifiedHost?.eligible && (
        <button
          type="button"
          onClick={openConfirm}
          disabled={!canConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B] py-4 text-base font-black text-[#1A1424] shadow-[0_12px_30px_-12px_rgba(203,163,92,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-40"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {/* Confirmation modal */}
      <AnimatePresence>
        {step === "confirm" && verifiedHost && (
          <ConfirmModal
            host={verifiedHost}
            amount={parsedAmount}
            balance={balance}
            submitting={submitting}
            error={payError}
            onCancel={() => setStep("enter")}
            onConfirm={() => void handleConfirm()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span className={cn("font-semibold", muted ? "text-rose-300" : "text-white/80")}>{value}</span>
    </div>
  );
}

function ConfirmModal({
  host,
  amount,
  balance,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  host: HostVerification;
  amount: number;
  balance: number;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const initials = (host.name || host.handle || "?").trim().slice(0, 1).toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-[28px] border-t border-white/10 bg-[#1A1424] p-5 sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <ShieldCheck className="h-5 w-5 text-[#CBA35C]" /> Confirm Host Payment
        </h2>

        <div className="mt-4 flex items-center gap-3">
          {host.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={host.avatar} alt={host.name} className="h-11 w-11 rounded-full object-cover ring-1 ring-[#CBA35C]/40" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2A2238] text-sm font-black text-[#CBA35C]">
              {initials}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{host.name}</p>
            <p className="text-xs text-white/45">ID: {host.publicId ?? host.handle}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl bg-white/[0.03] p-3.5 text-sm">
          <Row label="Payment" value={`${formatCoins(amount)} Coins`} />
          <Row label="Agency Trading Balance" value={`${formatCoins(balance)} Coins`} />
          <div className="h-px bg-white/10" />
          <Row label="Balance After Payment" value={`${formatCoins(balance - amount)} Coins`} />
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#CBA35C] to-[#E0B76B] py-3 text-sm font-black text-[#1A1424] transition hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {submitting ? "Processing…" : `Confirm ${formatCoins(amount)} Coin Payment`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SuccessPanel({
  host,
  result,
  onDone,
}: {
  host: HostVerification;
  result: HostPaymentResult;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border border-[#2A2238] bg-gradient-to-b from-[#241C33] to-[#1A1424] p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30"
      >
        <Check className="h-8 w-8 text-emerald-300" />
      </motion.div>

      <h2 className="mt-4 text-xl font-black text-white">Payment Successful</h2>
      <p className="mt-1 text-sm text-white/50">
        {formatCoins(result.amount)} Coins sent to:
      </p>
      <p className="mt-2 text-lg font-bold text-[#CBA35C]">{host.name}</p>
      <p className="text-xs text-white/45">Host ID: {host.publicId ?? host.handle}</p>

      <div className="mt-5 space-y-2 rounded-xl bg-white/[0.03] p-3.5 text-sm">
        <Row label="Remaining Trading Balance" value={`${formatCoins(result.newBalance)} Coins`} />
        <Row label="Transaction ID" value={shortId(result.paymentId)} />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-5 w-full rounded-xl bg-[#CBA35C] py-3 text-sm font-black text-[#1A1424] transition hover:brightness-110 active:scale-[0.99]"
      >
        Transfer Again
      </button>
    </motion.div>
  );
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
