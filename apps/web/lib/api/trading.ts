// File: apps/web/lib/api/trading.ts
//
// Client for the Agency Trading Center (/api/v1/trading). All privileged
// operations resolve the agency from the authenticated user server-side; this
// client never sends an agency_id for authorization and never computes a
// balance.

import { apiFetch } from "@/lib/api/client";
import { newClientRequestId } from "@/lib/api/financial";

interface TradingEnvelope<T> {
  success: boolean;
  data: T;
}

export type TradingDirection = "credit" | "debit";

export type TradingTransactionType =
  | "AGENCY_COIN_PURCHASE"
  | "HOST_PAYMENT"
  | "ADJUSTMENT"
  | "REVERSAL";

export interface TradingAgency {
  id: string;
  name: string;
  code: string;
  ownerId: string;
}

export interface TradingAccount {
  agencyId: string;
  availableBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface TradingOverview {
  agency: TradingAgency;
  account: TradingAccount;
}

export interface TradingLedgerEntry {
  id: string;
  transactionType: TradingTransactionType;
  direction: TradingDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HostVerification {
  id: string;
  publicId: string | null;
  name: string;
  handle: string;
  avatar: string | null;
  isVerified: boolean;
  isHost: boolean;
  isAgencyMember: boolean;
  eligible: boolean;
}

export interface HostPaymentResult {
  paymentId: string;
  amount: number;
  newBalance: number;
  alreadyProcessed: boolean;
  hostId: string;
}

export type CoinOrderStatus = "pending" | "completed" | "expired";
export type CoinOrderNetwork = "TRC20" | "BEP20";

export interface CoinOrder {
  id: string;
  status: CoinOrderStatus;
  tierUsd: number;
  totalCoins: number;
  baseCoins: number;
  bonusPct: number;
  coin: string;
  networkLabel: CoinOrderNetwork;
  depositAddress: string;
  /** Exact amount to send, e.g. "1000.37". Server-generated. */
  payAmount: string;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface CoinOrderVerifyResult {
  status: "completed" | "pending" | "expired" | "not_found" | "rejected";
  order: CoinOrder;
  newBalance?: number;
  message?: string;
}

export { newClientRequestId };

export const tradingApi = {
  overview() {
    return apiFetch<TradingEnvelope<TradingOverview>>("/api/v1/trading/account").then(
      (r) => r.data,
    );
  },

  transactions(limit = 20, offset = 0) {
    return apiFetch<TradingEnvelope<TradingLedgerEntry[]>>(
      `/api/v1/trading/transactions?limit=${limit}&offset=${offset}`,
    ).then((r) => r.data);
  },

  verifyHost(hostId: string) {
    return apiFetch<TradingEnvelope<HostVerification>>("/api/v1/trading/hosts/verify", {
      method: "POST",
      body: JSON.stringify({ hostId }),
    }).then((r) => r.data);
  },

  payHost(input: { hostId: string; amount: number; idempotencyKey: string }) {
    return apiFetch<TradingEnvelope<HostPaymentResult>>("/api/v1/trading/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  // ── Automated agency coin purchase (server prices + verifies via Binance) ──
  createCoinOrder(input: { tierUsd: number; network: CoinOrderNetwork }) {
    return apiFetch<TradingEnvelope<CoinOrder>>("/api/v1/trading/coin-orders", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data);
  },

  coinOrders() {
    return apiFetch<TradingEnvelope<CoinOrder[]>>("/api/v1/trading/coin-orders").then((r) => r.data);
  },

  verifyCoinOrder(orderId: string, txId?: string) {
    return apiFetch<TradingEnvelope<CoinOrderVerifyResult>>(
      `/api/v1/trading/coin-orders/${encodeURIComponent(orderId)}/verify`,
      { method: "POST", body: JSON.stringify(txId ? { txId } : {}) },
    ).then((r) => r.data);
  },
};