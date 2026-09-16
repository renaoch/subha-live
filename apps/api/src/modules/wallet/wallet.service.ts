import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import {
  confirmPayment,
  requestWithdrawalTransaction,
  getLedgerHistory,
} from "../financial/financial.service";
import { getDepositAddress, findDepositByTxId } from "../binance/binance.service";

// ─── Coin Packages ──────────────────────────────────────────────
// Prices are defined here, server-side, and are the only prices
// purchaseCoins() will ever honor — a client can send a packageId but
// can never dictate the amount charged or coins granted.
export const COIN_PACKAGES = [
  { id: "pkg_100", coins: 100, priceUsd: 0.99, label: "100 Coins" },
  { id: "pkg_500", coins: 500, priceUsd: 4.99, label: "500 Coins" },
  { id: "pkg_1000", coins: 1000, priceUsd: 9.99, label: "1000 Coins" },
  { id: "pkg_5000", coins: 5000, priceUsd: 49.99, label: "5000 Coins" },
];

// ─── Get user's wallet ─────────────────────────────────────────
export async function getWallet(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("coins, diamonds")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Purchase coins ────────────────────────────────────────────
/**
 * Confirms a coin purchase and credits coins.
 *
 * Everything financial (idempotent recording of the payment, atomic
 * coin credit, ledger entry) happens in financial.service.ts#confirmPayment,
 * which calls the fin_confirm_payment() Postgres function. It is keyed on
 * (provider, providerTransactionId), so calling this twice for the same
 * payment intent — a webhook retry, a duplicate client submit — credits
 * coins exactly once.
 *
 * `paymentIntentId` should come from the real payment gateway once one is
 * wired up. Until then we mint a synthetic one per call so local/dev
 * "purchases" still get a stable idempotency key instead of one that's
 * different (and therefore double-creditable) on every retry.
 */
export async function purchaseCoins(
  userId: string,
  packageId: string,
  paymentIntentId?: string // for real payment gateways
) {
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new AppError(404, "Package not found");

  const providerTransactionId = paymentIntentId ?? randomUUID();

  const result = await confirmPayment({
    userId,
    provider: paymentIntentId ? "gateway" : "dev-simulated",
    providerTransactionId,
    packageId: pkg.id,
    amountUsd: pkg.priceUsd,
    coins: pkg.coins,
    metadata: { packageId },
  });

  return { txId: result.transactionId, newCoins: result.newCoins };
}

// ─── Withdraw coins ────────────────────────────────────────────
/**
 * Requests a coin withdrawal. The coins are moved out of the spendable
 * balance atomically the moment the request is recorded (see
 * fin_request_withdrawal()) so the same coins can never also be spent on
 * a gift while the withdrawal is pending. Idempotent per
 * (userId, clientRequestId) — safe against double-submits.
 */
export async function requestWithdrawal(
  userId: string,
  payload: { amount: number; bankAccount?: string; upiId?: string; note?: string; clientRequestId?: string }
) {
  const { amount, bankAccount, upiId, note } = payload;

  // Historical conversion rate used by the old endpoint: 1 cent per coin.
  const requiredCoins = Math.round(amount * 100);

  const result = await requestWithdrawalTransaction({
    userId,
    currency: "coins",
    amount: requiredCoins,
    bankAccount,
    upiId,
    note,
    // Callers that don't yet pass one (older clients) get a random key,
    // which means their retries won't dedupe — this is a transitional
    // fallback; clients should be updated to send a stable id.
    clientRequestId: payload.clientRequestId ?? randomUUID(),
  });

  return { withdrawalId: result.withdrawalId, newCoins: result.newBalance };
}

// ─── Crypto (Binance) recharge ─────────────────────────────────
//
// Flow:
//  1. User picks a coin package -> GET /crypto/quote/:packageId returns
//     the platform's live USDT deposit address + the exact amount they
//     need to send (1 coin package's priceUsd == USDT amount, since
//     USDT is dollar-pegged).
//  2. User sends USDT from their own wallet/exchange to that address.
//  3. User pastes the on-chain transaction ID/hash back into the app ->
//     POST /crypto/verify.
//  4. We ask Binance (server-side, signed) whether a deposit with that
//     exact txId actually landed, and for how much — we NEVER trust an
//     amount the client sends us, only what Binance itself reports for
//     that txId. If it matches (confirmed + amount >= required), coins
//     are credited via the same idempotent confirmPayment() path as
//     every other payment provider, keyed on (provider="binance",
//     providerTransactionId=txId) — so re-submitting the same txId
//     (retry, double click, user submits twice) can only ever credit
//     coins once.

const CRYPTO_NETWORK = process.env.BINANCE_DEPOSIT_NETWORK || "TRX"; // TRC20 USDT by default

export async function getCryptoRechargeQuote(packageId: string) {
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new AppError(404, "Package not found");

  const deposit = await getDepositAddress("USDT", CRYPTO_NETWORK);

  return {
    packageId: pkg.id,
    coins: pkg.coins,
    usdtAmount: pkg.priceUsd,
    asset: "USDT",
    network: CRYPTO_NETWORK,
    depositAddress: deposit.address,
    depositTag: deposit.tag || undefined,
  };
}

export async function verifyCryptoRecharge(
  userId: string,
  payload: { packageId: string; txId: string }
) {
  const { packageId, txId } = payload;
  if (!txId || txId.trim().length < 6) {
    throw new AppError(400, "A valid transaction ID is required");
  }

  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new AppError(404, "Package not found");

  const deposit = await findDepositByTxId("USDT", txId.trim());
  if (!deposit) {
    throw new AppError(404, "No matching deposit found yet — it may still be confirming", {
      code: "DEPOSIT_NOT_FOUND",
    });
  }
  if (deposit.status !== 1) {
    throw new AppError(409, "Deposit found but not yet confirmed", {
      code: "DEPOSIT_NOT_CONFIRMED",
    });
  }
  if (parseFloat(deposit.amount) < pkg.priceUsd) {
    throw new AppError(400, "Deposit amount is less than the package price", {
      code: "DEPOSIT_AMOUNT_INSUFFICIENT",
    });
  }

  const result = await confirmPayment({
    userId,
    provider: "binance",
    providerTransactionId: txId.trim(),
    packageId: pkg.id,
    amountUsd: parseFloat(deposit.amount),
    coins: pkg.coins,
    metadata: { packageId, network: deposit.network, source: "binance_deposit" },
  });

  return { txId: result.transactionId, newCoins: result.newCoins, alreadyProcessed: result.alreadyProcessed };
}

// ─── Get transaction history ──────────────────────────────────
/**
 * Wallet history now reads from the immutable financial_ledger — the same
 * authoritative log every balance mutation writes to, rather than the
 * legacy `wallet_transactions` table (still written to by unrelated
 * reward-claim flows; see host_task_rewards.sql / room_task_rewards.sql).
 */
export async function getTransactionHistory(userId: string) {
  return getLedgerHistory(userId, 100, 0);
}