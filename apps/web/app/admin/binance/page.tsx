"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  Loader2,
  RefreshCw,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "USDTINR"];

type PriceTick = { symbol: string; price: string };
type Balance = { asset: string; free: string; locked: string };

export default function BinanceTreasuryPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prices, setPrices] = useState<PriceTick[]>([]);
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Order form
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quoteAmount, setQuoteAmount] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const status = (await api.get("/api/v1/binance/status")) as any;
      setConfigured(Boolean(status?.data?.configured ?? status?.configured));

      const priceRes = (await api.get(
        `/api/v1/binance/prices?symbols=${SYMBOLS.join(",")}`
      )) as any;
      setPrices(priceRes?.data ?? priceRes ?? []);

      try {
        const balRes = (await api.get("/api/v1/binance/account/balances")) as any;
        setBalances(balRes?.data ?? balRes ?? []);
      } catch {
        // Not an admin, or Binance not configured yet — balances stay null,
        // page still shows public prices.
        setBalances(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load Binance data.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlaceOrder() {
    if (!quoteAmount || Number(quoteAmount) <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    try {
      setPlacing(true);
      setError(null);
      setSuccess(null);
      await api.post("/api/v1/binance/orders", {
        symbol,
        side,
        quoteOrderQty: Number(quoteAmount),
      });
      setSuccess(`${side === "BUY" ? "Bought" : "Sold"} ${symbol} for ${quoteAmount}.`);
      setQuoteAmount("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Order failed.");
    } finally {
      setPlacing(false);
    }
  }

  const priceFor = (s: string) => prices.find((p) => p.symbol === s)?.price;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-[#F3ECE0]">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Binance Treasury</h1>
          <p className="mt-1 text-xs text-white/30">
            Platform account · server-signed · admin only
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-xl border border-white/10 p-2 text-white/50 hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Configuration status */}
      <div
        className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
          configured
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/20 bg-amber-500/10 text-amber-300"
        }`}
      >
        {configured ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {configured
          ? "Binance API credentials are configured on the server."
          : "BINANCE_API_KEY / BINANCE_API_SECRET are not set in the server environment yet."}
      </div>

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

      {/* Live prices */}
      <div className="mt-8">
        <h2 className="text-sm font-black uppercase tracking-wide text-white/30">
          Live Prices
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {SYMBOLS.map((s) => (
            <div
              key={s}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2 text-white/40">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-bold">{s}</span>
              </div>
              <p className="mt-2 text-xl font-black">
                {priceFor(s) ? Number(priceFor(s)).toLocaleString() : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Account balances */}
      <div className="mt-8">
        <h2 className="text-sm font-black uppercase tracking-wide text-white/30">
          Account Balances
        </h2>
        {!balances ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center text-xs text-white/30">
            <Wallet className="mx-auto h-6 w-6 text-white/15" />
            <p className="mt-2">Unavailable — not an admin, or not yet configured.</p>
          </div>
        ) : balances.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center text-xs text-white/30">
            No nonzero balances.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {balances.map((b) => (
              <div
                key={b.asset}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-4"
              >
                <span className="font-bold">{b.asset}</span>
                <div className="text-right text-xs">
                  <p className="font-bold text-white">{Number(b.free).toLocaleString()}</p>
                  {Number(b.locked) > 0 && (
                    <p className="text-white/30">{b.locked} locked</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Place order */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-bold">Place Market Order</h3>
        <p className="mt-1 text-[11px] text-white/30">
          Executes immediately against the platform account. Double-check symbol and side.
        </p>
        <div className="mt-3 space-y-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#17131F] px-4 text-sm outline-none focus:border-violet-400"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setSide("BUY")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                side === "BUY"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                  : "border-white/10 text-white/30"
              }`}
            >
              <ArrowDownRight className="h-3 w-3" /> Buy
            </button>
            <button
              onClick={() => setSide("SELL")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                side === "SELL"
                  ? "border-red-400 bg-red-500/20 text-red-300"
                  : "border-white/10 text-white/30"
              }`}
            >
              <ArrowUpRight className="h-3 w-3" /> Sell
            </button>
          </div>

          <input
            type="number"
            placeholder="Quote amount (e.g. USDT to spend/receive)"
            value={quoteAmount}
            onChange={(e) => setQuoteAmount(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-violet-400"
          />

          <button
            onClick={handlePlaceOrder}
            disabled={placing || !configured}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-500 font-bold transition hover:bg-violet-400 disabled:opacity-50"
          >
            {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place ${side} Order`}
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-white/15">
        API credentials never leave the server. Withdrawal permission should never be enabled
        on the API key used here.
      </p>
    </div>
  );
}