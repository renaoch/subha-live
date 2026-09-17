import { binancePublicRequest, binanceSignedRequest, isBinanceConfigured } from "../../lib/binance";
import { AppError } from "../../errors/app-error";
import { confirmPayment } from "../financial/financial.service";

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

/* ────────────────────────────────────────────────────────────────────── */
/* AUTOMATED, BACKEND-VERIFIED CRYPTO RECHARGE (no admin step)            */
/* ────────────────────────────────────────────────────────────────────── */
//
// Coins a user is allowed to recharge with. Kept separate from
// ALLOWED_SYMBOLS (trading pairs) since not every deposit coin has (or
// needs) a direct pair — USDT is priced 1:1 with itself.
const ALLOWED_DEPOSIT_COINS = new Set(["USDT", "BTC", "ETH", "BNB"]);

// How many in-app coins one USD of verified deposit is worth. Mirrors the
// conversion already used for manually-approved offline recharges
// (offline-recharge.service.ts#creditRecharge) so the two paths stay
// consistent from the user's point of view.
const APP_COINS_PER_USD = 100;

function assertAllowedDepositCoin(coin: string) {
  if (!ALLOWED_DEPOSIT_COINS.has(coin)) {
    throw new AppError(400, `Recharging with ${coin} is not supported`, {
      code: "BINANCE_DEPOSIT_COIN_NOT_ALLOWED",
    });
  }
}

// Converts a deposited amount of `coin` into its USD value using
// Binance's own live ticker — never a value the client supplies. USDT is
// treated as 1:1 with USD (fine for this app's purposes; USDT can and
// does drift a little from $1, but not enough to matter for coin
// crediting here).
async function estimateUsdValue(coin: string, amount: number): Promise<number> {
  if (coin === "USDT") return amount;

  const pair = `${coin}USDT`;
  const { price } = await getSymbolPrice(pair);
  return amount * parseFloat(price);
}

/**
 * The only entry point that credits app coins for a crypto deposit.
 *
 * Trust model: the client supplies only `coin` and `txId` — never an
 * amount. Everything that determines how much gets credited (whether the
 * deposit exists, whether it has actually confirmed, and its amount)
 * comes from Binance's own deposit-history record for that txId,
 * fetched server-side with the platform's signed API credentials. The
 * user cannot inflate or fabricate a deposit by lying in the request.
 *
 * Idempotency / no-double-credit: confirmPayment() -> fin_confirm_payment()
 * treats (provider, providerTransactionId) as the dedup key inside a DB
 * transaction, so resubmitting the same txId (by the same user, or by
 * two different users racing on the same txId) can only ever credit
 * once — the second call comes back with alreadyProcessed: true instead
 * of crediting again.
 *
 * No admin is involved anywhere in this path — verification against
 * Binance's ledger *is* the verification.
 */
export async function verifyAndCreditDeposit(params: {
  userId: string;
  coin: string;
  txId: string;
}) {
  const coin = params.coin.toUpperCase().trim();
  const txId = params.txId.trim();

  assertAllowedDepositCoin(coin);
  if (!txId) {
    throw new AppError(400, "txId is required", { code: "BINANCE_TXID_REQUIRED" });
  }

  const deposit = await findDepositByTxId(coin, txId);
  if (!deposit) {
    throw new AppError(
      404,
      "No deposit found for that transaction ID yet. If you just sent it, it may still be confirming — try again in a few minutes.",
      { code: "BINANCE_DEPOSIT_NOT_FOUND" }
    );
  }

  // 0 = still pending on-chain confirmations. Do not credit yet — the
  // user should retry once Binance shows it as arrived.
  if (deposit.status === 0) {
    return {
      confirmed: false as const,
      status: "pending" as const,
    };
  }

  // 1 = fully credited on Binance's side, 6 = credited but withdrawal
  // temporarily restricted (e.g. new address risk hold) — funds have
  // still actually arrived in either case, so both are creditable here.
  if (deposit.status !== 1 && deposit.status !== 6) {
    throw new AppError(409, "This deposit could not be verified as successful.", {
      code: "BINANCE_DEPOSIT_NOT_CONFIRMED",
      details: { status: deposit.status },
    });
  }

  const amount = parseFloat(deposit.amount);
  const amountUsd = await estimateUsdValue(coin, amount);
  const coinsToCredit = Math.floor(amountUsd * APP_COINS_PER_USD);

  const result = await confirmPayment({
    userId: params.userId,
    provider: "binance",
    // Namespaced by coin: Binance guarantees txId uniqueness per coin's
    // ledger, not necessarily globally across every asset.
    providerTransactionId: `${coin}:${txId}`,
    amountUsd,
    coins: coinsToCredit,
    metadata: {
      coin,
      network: deposit.network,
      address: deposit.address,
      rawAmount: deposit.amount,
      binanceStatus: deposit.status,
      insertTime: deposit.insertTime,
    },
  });

  return {
    confirmed: true as const,
    status: "confirmed" as const,
    coin,
    amount,
    amountUsd,
    newCoins: result.newCoins,
    alreadyProcessed: result.alreadyProcessed,
  };
}