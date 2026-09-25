"use client";

import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import type { TradingLedgerEntry } from "@/lib/api/trading";
import { cn } from "@/lib/utils";
import { formatCoins } from "./format";

interface TransactionListProps {
  transactions: TradingLedgerEntry[];
  loading: boolean;
}

export function TransactionList({ transactions, loading }: TransactionListProps) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
        <Receipt className="h-4 w-4 text-[#CBA35C]" /> Recent Activity
      </h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#1D1829]/60" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-sm font-semibold text-white/40">No trading activity yet</p>
          <p className="mt-1 text-xs text-white/30">Coin purchases and host payments will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TransactionRow({ tx }: { tx: TradingLedgerEntry }) {
  const credit = tx.direction === "credit";
  const label =
    tx.transactionType === "HOST_PAYMENT"
      ? "Host Payment"
      : tx.transactionType === "AGENCY_COIN_PURCHASE"
        ? "Agency Coin Purchase"
        : tx.transactionType;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 px-3.5 py-3">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          credit ? "bg-emerald-500/10 text-emerald-300" : "bg-[#CBA35C]/10 text-[#CBA35C]",
        )}
      >
        {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/40">
          {new Date(tx.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · Completed
        </p>
      </div>

      <span className={cn("shrink-0 text-sm font-black", credit ? "text-emerald-300" : "text-[#E8C27A]")}>
        {credit ? "+" : "−"}
        {formatCoins(tx.amount)}
      </span>
    </li>
  );
}
