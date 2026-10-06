// Agency coin orders — server-driven, Binance-verified purchases.
//
// Authority model:
//   * Only the OWNER of an active agency can create/read/verify its orders;
//     the agency is always resolved server-side from the session.
//   * Price, coins, and the payable amount are decided here, never by the client.
//   * "Paid" is decided ONLY by Binance's own deposit history (signed, server-side)
//     and the DB settle function — there is no admin step and no user-supplied
//     amount anywhere in the path.

import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { getDepositAddress, findDepositByTxId, listSuccessfulDeposits } from "../binance/binance.service";
import { isBinanceConfigured, isBinanceTestnet } from "../../lib/binance";
import {
  COIN_ORDER_NETWORKS,
  MAX_PENDING_ORDERS_PER_AGENCY,
  ORDER_COIN,
  ORDER_TTL_MINUTES,
  computeCoins,
  evaluateDeposit,
  formatMicros,
  getTier,
  makePayableMicros,
  type BinanceDeposit,
  type CoinOrderNetworkLabel,
  type DepositRejection,
  type OrderForMatch,
} from "./coin-order.logic";
import { resolveOwnedActiveAgency } from "./trading.repository";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

export interface CoinOrderRow {
  id: string;
  agency_id: string;
  user_id: string;
  tier_usd: number;
  base_coins: number;
  bonus_pct: number;
  total_coins: number;
  coin: string;
  network: string;
  deposit_address: string;
  expected_micros: number;
  status: "pending" | "completed" | "expired";
  tx_id: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

export interface CoinOrderView {
  id: string;
  status: "pending" | "completed" | "expired";
  tierUsd: number;
  totalCoins: number;
  baseCoins: number;
  bonusPct: number;
  coin: string;
  networkLabel: CoinOrderNetworkLabel;
  depositAddress: string;
  /** Exact amount that must arrive, e.g. "1000.37". */
  payAmount: string;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface VerifyResult {
  status: "completed" | "pending" | "expired" | "not_found" | "rejected";
  order: CoinOrderView;
  newBalance?: number;
  /** Human-readable hint for the UI when not completed. */
  message?: string;
}

const SETTLE_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  TX_ALREADY_USED: { status: 409, code: "TX_ALREADY_USED", message: "This transaction has already been used for another purchase." },
  AMOUNT_MISMATCH: { status: 409, code: "AMOUNT_MISMATCH", message: "Deposit amount does not match this order." },
  DEPOSIT_BEFORE_ORDER: { status: 409, code: "DEPOSIT_BEFORE_ORDER", message: "This deposit was made before the order was created." },
  DEPOSIT_AFTER_EXPIRY: { status: 409, code: "DEPOSIT_AFTER_EXPIRY", message: "This deposit arrived after the order expired. Contact support." },
  ORDER_NOT_FOUND: { status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" },
};

const REJECTION_MESSAGES: Record<DepositRejection, string> = {
  WRONG_COIN: "That transaction is not a USDT deposit.",
  NOT_CONFIRMED: "Deposit is still confirming. It will be credited automatically.",
  BAD_AMOUNT: "Deposit amount could not be read.",
  AMOUNT_MISMATCH: "The deposit amount does not match this order's exact amount. Send the exact amount shown.",
  WRONG_NETWORK: "The deposit arrived on a different network than this order.",
  WRONG_ADDRESS: "The deposit was not sent to this order's address.",
  BEFORE_ORDER: "That transaction was made before this order was created.",
  AFTER_EXPIRY: "That deposit arrived after this order expired. Contact support.",
  BAD_TXID: "Invalid transaction ID.",
};

function labelForNetwork(code: string): CoinOrderNetworkLabel {
  const found = (Object.entries(COIN_ORDER_NETWORKS) as [CoinOrderNetworkLabel, string][]).find(([, c]) => c === code);
  return found ? found[0] : "TRC20";
}

export function toView(row: CoinOrderRow): CoinOrderView {
  return {
    id: row.id,
    status: row.status,
    tierUsd: Number(row.tier_usd),
    totalCoins: Number(row.total_coins),
    baseCoins: Number(row.base_coins),
    bonusPct: Number(row.bonus_pct),
    coin: row.coin,
    networkLabel: labelForNetwork(row.network),
    depositAddress: row.deposit_address,
    payAmount: formatMicros(Number(row.expected_micros)),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
  };
}

function toMatch(row: CoinOrderRow): OrderForMatch {
  return {
    coin: row.coin,
    network: row.network,
    depositAddress: row.deposit_address,
    expectedMicros: Number(row.expected_micros),
    createdAtMs: Date.parse(row.created_at),
    expiresAtMs: Date.parse(row.expires_at),
  };
}

async function requireOwnedAgency(userId: string) {
  const agency = await resolveOwnedActiveAgency(userId);
  if (!agency) throw new AppError(403, "You do not own an active agency", { code: "AGENCY_OWNER_REQUIRED" });
  return agency;
}

function assertBinanceReady() {
  if (!isBinanceConfigured()) {
    throw new AppError(503, "Automated payments are temporarily unavailable.", { code: "BINANCE_NOT_CONFIGURED" });
  }
  // The testnet has no wallet/deposit endpoints, so a "verified" payment there
  // could never be real. Refuse rather than ever credit against mock data.
  if (isBinanceTestnet()) {
    throw new AppError(503, "Automated payments are unavailable in test mode.", { code: "BINANCE_TESTNET" });
  }
}

async function loadOwnedOrder(agencyId: string, orderId: string): Promise<CoinOrderRow> {
  const { data, error } = await db
    .from("agency_coin_orders")
    .select("*")
    .eq("id", orderId)
    .eq("agency_id", agencyId) // never expose another agency's order
    .maybeSingle();
  if (error) throw new AppError(500, "Failed to load order", { code: "ORDER_LOAD_FAILED" });
  if (!data) throw new AppError(404, "Order not found", { code: "ORDER_NOT_FOUND" });
  return data as CoinOrderRow;
}

// ─── Settlement (shared by user-triggered verify and the poller) ──────────

export async function settleOrder(
  order: CoinOrderRow,
  deposit: BinanceDeposit,
  source: "poller" | "user_verify",
): Promise<{ newBalance: number; alreadyProcessed: boolean } | { rejected: DepositRejection }> {
  const evaluation = evaluateDeposit(toMatch(order), deposit);
  if (!evaluation.ok) return { rejected: evaluation.reason };

  const { data, error } = await db.rpc("fin_settle_agency_coin_order", {
    p_order_id: order.id,
    p_tx_id: deposit.txId,
    p_binance_deposit_id: deposit.id ?? null,
    p_received_micros: evaluation.receivedMicros,
    p_deposit_time: new Date(deposit.insertTime).toISOString(),
  });

  if (error) {
    const message = String(error.message ?? "");
    const code = Object.keys(SETTLE_ERRORS).find((c) => message.includes(c));
    if (code) {
      const m = SETTLE_ERRORS[code];
      throw new AppError(m.status, m.message, { code: m.code });
    }
    console.error("[coin-order] settle failed:", message);
    throw new AppError(500, "Could not complete the purchase. It will be retried automatically.", {
      code: "ORDER_SETTLE_FAILED",
    });
  }

  const row = (Array.isArray(data) ? data[0] : data) as { new_balance?: number; already_processed?: boolean };
  const alreadyProcessed = Boolean(row?.already_processed);

  if (!alreadyProcessed) {
    await logAudit({
      actorId: order.user_id,
      agencyId: order.agency_id,
      action: "AGENCY_COIN_ORDER_SETTLED",
      entityType: "agency_coin_orders",
      entityId: order.id,
      newValue: {
        source,
        tierUsd: order.tier_usd,
        coins: order.total_coins,
        txId: deposit.txId,
        newBalance: Number(row?.new_balance ?? 0),
      },
    });
  }

  return { newBalance: Number(row?.new_balance ?? 0), alreadyProcessed };
}

// ─── Public service ───────────────────────────────────────────────────────

export const coinOrderService = {
  async create(userId: string, input: { tierUsd: number; network: CoinOrderNetworkLabel }): Promise<CoinOrderView> {
    const agency = await requireOwnedAgency(userId);
    assertBinanceReady();

    const tier = getTier(input.tierUsd);
    if (!tier) throw new AppError(400, "Invalid purchase amount", { code: "INVALID_TIER" });

    const networkCode = COIN_ORDER_NETWORKS[input.network];
    if (!networkCode) throw new AppError(400, "Unsupported network", { code: "INVALID_NETWORK" });

    // Cap live orders so unique-amount space can't be exhausted by spamming.
    const { data: live, error: liveError } = await db
      .from("agency_coin_orders")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (liveError) throw new AppError(500, "Failed to create order", { code: "ORDER_CREATE_FAILED" });

    const liveRows = (live ?? []) as CoinOrderRow[];
    const reusable = liveRows.find((o) => Number(o.tier_usd) === tier.usd && o.network === networkCode);
    if (reusable) return toView(reusable); // idempotent: same choice -> same payable amount

    if (liveRows.length >= MAX_PENDING_ORDERS_PER_AGENCY) {
      throw new AppError(429, "You have too many unpaid orders. Complete or wait for them to expire.", {
        code: "TOO_MANY_PENDING_ORDERS",
      });
    }

    // Address comes from OUR Binance account at order time and is frozen on the order.
    const addr = await getDepositAddress(ORDER_COIN, networkCode);
    if (!addr?.address) throw new AppError(502, "Could not get a deposit address. Try again shortly.", { code: "DEPOSIT_ADDRESS_FAILED" });

    const { baseCoins, totalCoins } = computeCoins(tier);
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000).toISOString();

    // Retry on the (rare) unique-amount collision.
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data, error } = await db
        .from("agency_coin_orders")
        .insert({
          agency_id: agency.id,
          user_id: userId,
          tier_usd: tier.usd,
          base_coins: baseCoins,
          bonus_pct: tier.commissionPct,
          total_coins: totalCoins,
          coin: ORDER_COIN,
          network: networkCode,
          deposit_address: addr.address,
          expected_micros: makePayableMicros(tier.usd),
          expires_at: expiresAt,
        })
        .select("*")
        .single();

      if (!error && data) {
        await logAudit({
          actorId: userId,
          agencyId: agency.id,
          action: "AGENCY_COIN_ORDER_CREATED",
          entityType: "agency_coin_orders",
          entityId: (data as CoinOrderRow).id,
          newValue: { tierUsd: tier.usd, network: networkCode },
        });
        return toView(data as CoinOrderRow);
      }
      if (error?.code !== "23505") {
        console.error("[coin-order] insert failed:", error?.message);
        throw new AppError(500, "Failed to create order", { code: "ORDER_CREATE_FAILED" });
      }
    }
    throw new AppError(503, "Busy right now. Please try again in a moment.", { code: "ORDER_AMOUNT_COLLISION" });
  },

  async get(userId: string, orderId: string): Promise<CoinOrderView> {
    const agency = await requireOwnedAgency(userId);
    return toView(await loadOwnedOrder(agency.id, orderId));
  },

  async list(userId: string): Promise<CoinOrderView[]> {
    const agency = await requireOwnedAgency(userId);
    const { data, error } = await db
      .from("agency_coin_orders")
      .select("*")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new AppError(500, "Failed to load orders", { code: "ORDER_LIST_FAILED" });
    return ((data ?? []) as CoinOrderRow[]).map(toView);
  },

  /**
   * User-triggered check (also what the UI polls). With a txId it looks that
   * exact transaction up on Binance; without one it scans recent deposits for
   * this order's unique amount. Either way the credit goes through the same
   * validate-then-settle path as the background poller.
   */
  async verify(userId: string, orderId: string, txId?: string): Promise<VerifyResult> {
    const agency = await requireOwnedAgency(userId);
    let order = await loadOwnedOrder(agency.id, orderId);

    if (order.status === "completed") {
      const balance = await currentBalance(agency.id);
      return { status: "completed", order: toView(order), newBalance: balance };
    }

    assertBinanceReady();

    let deposit: BinanceDeposit | null = null;
    if (txId && txId.trim()) {
      const found = await findDepositByTxId(order.coin, txId.trim());
      deposit = found ? { ...found, transferType: (found as BinanceDeposit).transferType } : null;
    } else {
      const since = Date.parse(order.created_at) - 5 * 60 * 1000;
      const deposits = await listSuccessfulDeposits(order.coin, since, Date.now());
      deposit =
        deposits.find((d) => evaluateDeposit(toMatch(order), d as BinanceDeposit).ok) as BinanceDeposit | undefined ?? null;
    }

    if (!deposit) {
      return {
        status: Date.parse(order.expires_at) < Date.now() ? "expired" : "not_found",
        order: toView(order),
        message: "We haven't seen your payment yet. It's credited automatically once Binance confirms it.",
      };
    }

    const result = await settleOrder(order, deposit, "user_verify");
    if ("rejected" in result) {
      return {
        status: result.rejected === "NOT_CONFIRMED" ? "pending" : "rejected",
        order: toView(order),
        message: REJECTION_MESSAGES[result.rejected],
      };
    }

    order = await loadOwnedOrder(agency.id, orderId);
    return { status: "completed", order: toView(order), newBalance: result.newBalance };
  },
};

async function currentBalance(agencyId: string): Promise<number> {
  const { data } = await db
    .from("agency_trading_accounts")
    .select("available_balance")
    .eq("agency_id", agencyId)
    .maybeSingle();
  return Number(data?.available_balance ?? 0);
}