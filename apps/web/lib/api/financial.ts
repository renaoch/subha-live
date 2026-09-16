// File: apps/web/lib/api/financial.ts
//
// Client for /api/v1/financial — the authoritative gift/wallet endpoints.
// Gift prices come from the server-side catalog here; nothing in this
// file (or its callers) should ever invent or send a coin/diamond amount.

import { apiFetch } from "@/lib/api/client";

export interface GiftCatalogItem {
  id: string;
  code: string;
  name: string;
  icon: string;
  coinPrice: number;
  diamondValue: number;
  isActive: boolean;
}

interface GiftCatalogResponse {
  status: string;
  gifts: GiftCatalogItem[];
}

export interface SendGiftResult {
  giftTransactionId: string;
  senderNewCoins: number;
  recipientNewDiamonds: number;
  hostNetDiamonds: number;
  platformShareDiamonds: number;
  agencyCommissionDiamonds: number;
  status: "processing" | "completed" | "failed";
  alreadyProcessed: boolean;
}

interface SendGiftResponse {
  status: string;
  gift: SendGiftResult;
}

export interface LedgerEntry {
  id: string;
  wallet_type: "coins" | "diamonds";
  direction: "credit" | "debit";
  amount: number;
  balance_after: number | null;
  reason: string;
  reference_type: string;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface LedgerResponse {
  status: string;
  entries: LedgerEntry[];
}

export interface WithdrawalResult {
  withdrawalId: string;
  newBalance: number;
  status: string;
  alreadyProcessed: boolean;
}

interface WithdrawalResponse {
  status: string;
  withdrawal: WithdrawalResult;
}

export interface WithdrawalRecord {
  id: string;
  currency: "coins" | "diamonds";
  amount: number;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  processed_at: string | null;
  note: string | null;
  admin_note: string | null;
}

interface MyWithdrawalsResponse {
  status: string;
  withdrawals: WithdrawalRecord[];
}

/**
 * Generates a fresh idempotency key for one user action (one tap on
 * "send"). The SAME value must be reused if that exact action is
 * retried (e.g. after a network error) — never generate a new one on
 * retry, or the server can no longer tell a retry apart from a second,
 * intentional gift.
 */
export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very old browsers).
  return `crid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const financialApi = {
  /** Server-side gift price list. Never trust a locally-hardcoded price/value. */
  async giftCatalog(): Promise<GiftCatalogItem[]> {
    const response = await apiFetch<GiftCatalogResponse>("/api/v1/financial/gifts/catalog");
    return response.gifts;
  },

  /**
   * Sends a gift via the raw financial primitive only — this does NOT
   * trigger charisma progress, room-task progress, or PK scoring (see
   * charisma.service.ts#sendGift on the backend for those side effects).
   * UI gift-sending (the gift picker, profile gifting, etc.) should call
   * `charismaApi.send` instead, which performs this same atomic financial
   * transaction AND the presentation-layer side effects together. Reach
   * for this only from tooling that intentionally wants money movement
   * without those side effects (e.g. an admin/back-office action).
   */
  async sendGift(input: {
    recipientId: string;
    giftId: string;
    roomId?: string;
    clientRequestId: string;
  }): Promise<SendGiftResult> {
    const response = await apiFetch<SendGiftResponse>("/api/v1/financial/gifts/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.gift;
  },

  async ledger(limit = 50, offset = 0): Promise<LedgerEntry[]> {
    const response = await apiFetch<LedgerResponse>(
      `/api/v1/financial/ledger?limit=${limit}&offset=${offset}`,
    );
    return response.entries;
  },

  async requestWithdrawal(input: {
    currency: "coins" | "diamonds";
    amount: number;
    bankAccount?: string;
    upiId?: string;
    note?: string;
    clientRequestId: string;
  }): Promise<WithdrawalResult> {
    const response = await apiFetch<WithdrawalResponse>("/api/v1/financial/withdrawals", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.withdrawal;
  },

  /** This user's own withdrawal requests, newest first — the real, per-currency record (coins AND diamonds), unlike the legacy /wallet/withdraw history which only ever reflects coins. */
  async myWithdrawals(): Promise<WithdrawalRecord[]> {
    const response = await apiFetch<MyWithdrawalsResponse>("/api/v1/financial/withdrawals/me");
    return response.withdrawals;
  },
};