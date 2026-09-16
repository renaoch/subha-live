import { binancePublicRequest, binanceSignedRequest, isBinanceConfigured } from "../../lib/binance";
import { AppError } from "../../errors/app-error";

// Only these symbols can be traded/quoted through the app. Prevents any
// caller from asking the backend to sign a request for an arbitrary
// symbol/pair it wasn't meant to touch.
const ALLOWED_SYMBOLS = new Set(["USDTINR", "BTCUSDT", "ETHUSDT", "BNBUSDT"]);

function assertAllowedSymbol(symbol: string) {
  if (!ALLOWED_SYMBOLS.has(symbol)) {
    throw new AppError(400, `Symbol ${symbol} is not supported`, {
      code: "BINANCE_SYMBOL_NOT_ALLOWED",
    });
  }
}

// ─── Public: live price (safe to show any logged-in user) ─────────
export async function getSymbolPrice(symbol: string) {
  assertAllowedSymbol(symbol);
  return binancePublicRequest<{ symbol: string; price: string }>(
    "/api/v3/ticker/price",
    { symbol }
  );
}

export async function getSymbolPrices(symbols: string[]) {
  symbols.forEach(assertAllowedSymbol);
  const all = await binancePublicRequest<{ symbol: string; price: string }[]>(
    "/api/v3/ticker/price"
  );
  return all.filter((t) => symbols.includes(t.symbol));
}

// ─── Private: platform account balances ────────────────────────
// Uses the platform's own API key (env vars) — never a per-user key.
// Gate the route calling this to admins only; regular users should
// never see the raw platform treasury balance.
export async function getAccountBalances() {
  const account = await binanceSignedRequest<{
    balances: { asset: string; free: string; locked: string }[];
  }>("GET", "/api/v3/account");

  return account.balances.filter(
    (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );
}

// ─── Private: place a market order on the platform account ────────
// Called internally (e.g. from a "buy coins with crypto" flow) once your
// own business logic has already validated the user's request — this
// function itself only knows how to talk to Binance, not about your
// users, wallets, or ledger.
export async function placeMarketOrder(params: {
  symbol: string;
  side: "BUY" | "SELL";
  quoteOrderQty: number; // spend/receive this much of the quote asset
}) {
  assertAllowedSymbol(params.symbol);
  if (!(params.quoteOrderQty > 0)) {
    throw new AppError(400, "quoteOrderQty must be positive");
  }

  return binanceSignedRequest<{
    symbol: string;
    orderId: number;
    status: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    fills: { price: string; qty: string; commission: string }[];
  }>("POST", "/api/v3/order", {
    symbol: params.symbol,
    side: params.side,
    type: "MARKET",
    quoteOrderQty: params.quoteOrderQty,
  });
}

export async function getOrderStatus(symbol: string, orderId: number) {
  assertAllowedSymbol(symbol);
  return binanceSignedRequest<{ symbol: string; orderId: number; status: string }>(
    "GET",
    "/api/v3/order",
    { symbol, orderId }
  );
}

export async function getRecentOrders(symbol: string, limit = 20) {
  assertAllowedSymbol(symbol);
  return binanceSignedRequest<
    { symbol: string; orderId: number; side: string; status: string; time: number }[]
  >("GET", "/api/v3/allOrders", { symbol, limit });
}

export function getBinanceStatus() {
  return { configured: isBinanceConfigured() };
}

// ─── Private: deposit address for crypto recharges ─────────────
// Fetched live from the platform's own Binance account (signed) rather
// than hardcoded, so it always reflects whatever's actually configured
// there. Network defaults to TRC20 USDT (cheap, common) but can be
// overridden per call.
export async function getDepositAddress(coin: string, network?: string) {
  return binanceSignedRequest<{ address: string; coin: string; tag?: string; url?: string }>(
    "GET",
    "/sapi/v1/capital/deposit/address",
    { coin, network }
  );
}

// ─── Private: check whether a specific deposit has arrived/confirmed ──
// Used to verify a user's claimed crypto recharge before crediting
// coins. Matches Binance's own record of the deposit by txId — the
// user can never dictate the amount credited; we always trust the
// amount Binance reports for that specific txId, not what the user
// typed in a form.
export async function findDepositByTxId(coin: string, txId: string) {
  const history = await binanceSignedRequest<
    {
      id: string;
      amount: string;
      coin: string;
      network: string;
      status: number; // 0 = pending, 1 = success, 6 = credited but cannot withdraw
      address: string;
      txId: string;
      insertTime: number;
    }[]
  >("GET", "/sapi/v1/capital/deposit/hisrec", { coin, txId, limit: 5 });

  return history.find((d) => d.txId === txId) ?? null;
}