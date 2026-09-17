"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { Zap, Loader2, Copy, Check, AlertTriangle } from "lucide-react";

const COINS = ["USDT", "BTC", "ETH", "BNB"] as const;
type Coin = (typeof COINS)[number];

const NETWORKS_BY_COIN: Record<Coin, string[]> = {
  USDT: ["TRC20", "BEP20", "ERC20"],
  BTC: ["BTC"],
  ETH: ["ERC20"],
  BNB: ["BEP20"],
};

type DepositAddress = { address: string; coin: string; tag?: string; url?: string };

type VerifyResult =
  | { confirmed: true; status: "confirmed"; coin: string; amount: number; amountUsd: number; newCoins: number; alreadyProcessed: boolean }
  | { confirmed: false; status: "pending" };

export function CryptoRechargePanel({ onCredited }: { onCredited?: () => void }) {
  const [coin, setCoin] = useState<Coin>("USDT");
  const [network, setNetwork] = useState<string>(NETWORKS_BY_COIN.USDT[0]);
  const [address, setAddress] = useState<DepositAddress | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  const [txId, setTxId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function loadAddress(nextCoin: Coin, nextNetwork: string) {
    try {
      setLoadingAddress(true);
      setError(null);
      setAddress(null);
      const res = (await api.get(
        `/api/v1/binance/recharge/deposit-address?coin=${nextCoin}&network=${nextNetwork}`
      )) as DepositAddress;
      setAddress(res);
    } catch (err: any) {
      setError(err?.message || "Could not load a deposit address right now.");
    } finally {
      setLoadingAddress(false);
    }
  }

  function handleCoinChange(next: Coin) {
    setCoin(next);
    const nextNetwork = NETWORKS_BY_COIN[next][0];
    setNetwork(nextNetwork);
    setAddress(null);
    setResult(null);
    setError(null);
  }

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleVerify() {
    if (!txId.trim()) {
      setError("Enter the transaction ID / hash for your deposit.");
      return;
    }
    try {
      setVerifying(true);
      setError(null);
      setResult(null);
      const res = (await api.post("/api/v1/binance/recharge/verify", {
        coin,
        txId: txId.trim(),
      })) as VerifyResult;
      setResult(res);
      if (res.confirmed) {
        setTxId("");
        onCredited?.();
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "BINANCE_DEPOSIT_NOT_FOUND") {
        setError(err.message);
      } else {
        setError(err?.message || "Could not verify that deposit yet.");
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-5">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-violet-300" />
        <h2 className="text-sm font-black text-[#F3ECE0]">Instant Crypto Recharge</h2>
      </div>
      <p className="mt-1 text-[11px] text-white/40">
        Send crypto to your address below, then paste the transaction ID. Coins are credited
        automatically the moment it's confirmed on Binance — no waiting on manual review.
      </p>

      {/* Coin / network pickers */}
      <div className="mt-4 flex gap-2">
        {COINS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => handleCoinChange(c)}
            className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition ${
              coin === c
                ? "border-violet-400 bg-violet-500/20 text-violet-200"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {NETWORKS_BY_COIN[coin].length > 1 && (
        <div className="mt-2 flex gap-2">
          {NETWORKS_BY_COIN[coin].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setNetwork(n);
                setAddress(null);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${
                network === n
                  ? "border-violet-400/60 bg-violet-500/10 text-violet-200"
                  : "border-white/10 text-white/30"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Deposit address */}
      <div className="mt-3">
        {!address ? (
          <button
            type="button"
            onClick={() => loadAddress(coin, network)}
            disabled={loadingAddress}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            {loadingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingAddress ? "Fetching address..." : `Get ${coin} (${network}) deposit address`}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            <span className="truncate font-mono text-xs text-white/70">{address.address}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 hover:bg-white/10"
              title="Copy address"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {address?.tag && (
          <p className="mt-1 text-[10px] text-amber-300/80">
            Memo/Tag required: <span className="font-mono">{address.tag}</span>
          </p>
        )}
      </div>

      {/* Transaction ID + verify */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={txId}
          onChange={(e) => setTxId(e.target.value)}
          placeholder="Transaction ID / hash"
          className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-violet-400"
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          className="flex h-10 items-center justify-center rounded-xl bg-violet-500 px-4 text-xs font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {result && !result.confirmed && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          Still confirming on-chain. Wait a bit and hit Verify again — it'll credit automatically
          the moment Binance shows it as arrived.
        </div>
      )}

      {result && result.confirmed && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          {result.alreadyProcessed
            ? "This deposit was already credited."
            : `Confirmed! +${result.newCoins?.toLocaleString?.() ?? ""} coins added (≈$${result.amountUsd.toFixed(2)}).`}
        </div>
      )}
    </div>
  );
}
