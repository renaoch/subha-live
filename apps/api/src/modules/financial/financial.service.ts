// File: apps/api/src/modules/financial/financial.service.ts
//
// This is the ONLY place in the API that is allowed to mutate
// profiles.coins / profiles.diamonds. Every function here calls a
// Postgres RPC defined in
// supabase/migrations/20260903120000_financial_system.sql, which does the
// actual locking, balance verification, and ledger write inside a single
// database transaction. Nothing here does a read-then-write on a balance —
// if you find yourself tempted to `select coins ... then update coins`,
// that logic belongs in a new `fin_*` SQL function instead.
//
// Every RPC call maps Postgres `raise exception 'CODE'` errors to
// AppError via FINANCIAL_ERROR_MAP so callers get the same
// (status, code, message) shape the rest of the API already uses.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { FINANCIAL_ERROR_MAP, extractFinancialErrorCode } from "./financial.logic";
import type {
  ClaimAgencyTaskRewardResult,
  ConfirmPaymentResult,
  CreditOfflineRechargeResult,
  Currency,
  GiftCatalogItem,
  ProcessWithdrawalResult,
  RequestWithdrawalResult,
  SendGiftResult,
} from "./financial.types";

function throwMappedError(error: { message?: string } | null, fallbackMessage: string): never {
  const code = extractFinancialErrorCode(error?.message);
  if (code) {
    const mapped = FINANCIAL_ERROR_MAP[code];
    throw new AppError(mapped.status, mapped.message, { code: mapped.code });
  }
  throw new AppError(500, fallbackMessage, {
    code: "FINANCIAL_OPERATION_FAILED",
    details: error?.message,
  });
}

function firstRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

/**
 * Verify the given user is a platform admin. Throws otherwise.
 * Mirrors tasks.service.ts#assertIsPlatformAdmin / agency.service.ts's
 * inline admin checks — same convention, one shared copy for this module.
 */
export async function assertIsPlatformAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "Failed to verify admin permission", {
      code: "ADMIN_CHECK_FAILED",
      details: error.message,
    });
  }

  if (!data?.is_admin) {
    throw new AppError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
  }
}

// ─── Gift catalog (server-side prices — never trust the client) ──────────

export async function getActiveGiftCatalog(): Promise<GiftCatalogItem[]> {
  const { data, error } = await (supabase.from("gift_catalog" as any) as any)
    .select("id, code, name, icon, coin_price, diamond_value, is_active")
    .eq("is_active", true)
    .order("coin_price", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    icon: row.icon,
    coinPrice: row.coin_price,
    diamondValue: row.diamond_value,
    isActive: row.is_active,
  }));
}

export async function getGiftCatalogItem(giftId: string): Promise<GiftCatalogItem | null> {
  const { data, error } = await (supabase.from("gift_catalog" as any) as any)
    .select("id, code, name, icon, coin_price, diamond_value, is_active")
    .eq("id", giftId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    icon: data.icon,
    coinPrice: data.coin_price,
    diamondValue: data.diamond_value,
    isActive: data.is_active,
  };
}

// ─── Gifts ─────────────────────────────────────────────────────────────

export async function sendGiftTransaction(input: {
  senderId: string;
  recipientId: string;
  giftId: string;
  roomId?: string | null;
  clientRequestId: string;
}): Promise<SendGiftResult> {
  const { data, error } = await supabase.rpc("fin_send_gift" as any, {
    p_sender_id: input.senderId,
    p_recipient_id: input.recipientId,
    p_gift_id: input.giftId,
    p_room_id: input.roomId ?? null,
    p_client_request_id: input.clientRequestId,
  });

  if (error) {
    throwMappedError(error, "Failed to send gift");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Gift transaction did not return a result", {
      code: "GIFT_TRANSACTION_FAILED",
    });
  }

  return {
    giftTransactionId: row.gift_transaction_id,
    senderNewCoins: row.sender_new_coins,
    recipientNewDiamonds: row.recipient_new_diamonds,
    hostNetDiamonds: row.host_net_diamonds,
    platformShareDiamonds: row.platform_share_diamonds,
    agencyCommissionDiamonds: row.agency_commission_diamonds,
    status: row.status,
    alreadyProcessed: row.already_processed,
  };
}

// ─── Payments / recharges ────────────────────────────────────────────────

export async function confirmPayment(input: {
  userId: string;
  provider: string;
  providerTransactionId: string;
  packageId?: string | null;
  amountUsd: number;
  coins: number;
  metadata?: Record<string, unknown>;
}): Promise<ConfirmPaymentResult> {
  const { data, error } = await supabase.rpc("fin_confirm_payment" as any, {
    p_user_id: input.userId,
    p_provider: input.provider,
    p_provider_transaction_id: input.providerTransactionId,
    p_package_id: input.packageId ?? null,
    p_amount_usd: input.amountUsd,
    p_coins: input.coins,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throwMappedError(error, "Failed to confirm payment");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Payment confirmation did not return a result", {
      code: "PAYMENT_CONFIRMATION_FAILED",
    });
  }

  return {
    transactionId: row.transaction_id,
    newCoins: row.new_coins,
    alreadyProcessed: row.already_processed,
  };
}

export async function creditOfflineRecharge(input: {
  adminId: string;
  rechargeId: string;
  action: "approved" | "rejected";
  coins?: number;
  diamonds?: number;
  /**
   * Set when an agency owner (not a platform admin) is processing this
   * recharge for one of their own hosts. fin_credit_offline_recharge()
   * independently re-verifies that the recharge's user_id actually
   * belongs to this agency before crediting anything — this parameter is
   * not itself a trust boundary, the DB check is.
   */
  agencyId?: string | null;
}): Promise<CreditOfflineRechargeResult> {
  const { data, error } = await supabase.rpc("fin_credit_offline_recharge" as any, {
    p_admin_id: input.adminId,
    p_recharge_id: input.rechargeId,
    p_action: input.action,
    p_coins: input.coins ?? 0,
    p_diamonds: input.diamonds ?? 0,
    p_agency_id: input.agencyId ?? null,
  });

  if (error) {
    throwMappedError(error, "Failed to process offline recharge");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Recharge processing did not return a result", {
      code: "RECHARGE_PROCESSING_FAILED",
    });
  }

  await logAudit({
    actorId: input.adminId,
    action: `OFFLINE_RECHARGE_${input.action.toUpperCase()}`,
    entityType: "offline_recharges",
    entityId: input.rechargeId,
    newValue: {
      coins: input.coins ?? 0,
      diamonds: input.diamonds ?? 0,
      agencyId: input.agencyId ?? null,
      alreadyProcessed: row.already_processed,
    },
  });

  return {
    rechargeId: row.recharge_id,
    status: row.status,
    newCoins: row.new_coins,
    newDiamonds: row.new_diamonds,
    alreadyProcessed: row.already_processed,
  };
}

// ─── Withdrawals ──────────────────────────────────────────────────────────

export async function requestWithdrawalTransaction(input: {
  userId: string;
  currency: Currency;
  amount: number;
  bankAccount?: string | null;
  upiId?: string | null;
  note?: string | null;
  clientRequestId: string;
}): Promise<RequestWithdrawalResult> {
  const { data, error } = await supabase.rpc("fin_request_withdrawal" as any, {
    p_user_id: input.userId,
    p_currency: input.currency,
    p_amount: input.amount,
    p_bank_account: input.bankAccount ?? null,
    p_upi_id: input.upiId ?? null,
    p_note: input.note ?? null,
    p_client_request_id: input.clientRequestId,
  });

  if (error) {
    throwMappedError(error, "Failed to request withdrawal");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Withdrawal request did not return a result", {
      code: "WITHDRAWAL_REQUEST_FAILED",
    });
  }

  await logAudit({
    actorId: input.userId,
    action: "WITHDRAWAL_REQUESTED",
    entityType: "withdrawals",
    entityId: row.withdrawal_id,
    newValue: { currency: input.currency, amount: input.amount, alreadyProcessed: row.already_processed },
  });

  return {
    withdrawalId: row.withdrawal_id,
    newBalance: row.new_balance,
    status: row.status,
    alreadyProcessed: row.already_processed,
  };
}

export async function processWithdrawalTransaction(input: {
  adminId: string;
  withdrawalId: string;
  action: "approve" | "reject";
  adminNote?: string | null;
}): Promise<ProcessWithdrawalResult> {
  const { data, error } = await supabase.rpc("fin_process_withdrawal" as any, {
    p_withdrawal_id: input.withdrawalId,
    p_admin_id: input.adminId,
    p_action: input.action,
    p_admin_note: input.adminNote ?? null,
  });

  if (error) {
    throwMappedError(error, "Failed to process withdrawal");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Withdrawal processing did not return a result", {
      code: "WITHDRAWAL_PROCESSING_FAILED",
    });
  }

  await logAudit({
    actorId: input.adminId,
    action: `WITHDRAWAL_${input.action.toUpperCase()}D`,
    entityType: "withdrawals",
    entityId: input.withdrawalId,
    newValue: { action: input.action, note: input.adminNote, alreadyProcessed: row.already_processed },
  });

  return {
    withdrawalId: row.withdrawal_id,
    status: row.status,
    refundedBalance: row.refunded_balance,
    alreadyProcessed: row.already_processed,
  };
}

// ─── Agency task rewards (shares the wallet — must be equally safe) ──────

export async function claimAgencyTaskRewardTransaction(input: {
  hostId: string;
  taskId: string;
}): Promise<ClaimAgencyTaskRewardResult> {
  const { data, error } = await supabase.rpc("fin_claim_agency_task_reward" as any, {
    p_host_id: input.hostId,
    p_task_id: input.taskId,
  });

  if (error) {
    throwMappedError(error, "Failed to claim agency task reward");
  }

  const row = firstRow<any>(data);
  if (!row) {
    throw new AppError(500, "Task reward claim did not return a result", {
      code: "AGENCY_TASK_CLAIM_FAILED",
    });
  }

  return {
    rewardCoins: row.reward_coins,
    rewardDiamonds: row.reward_diamonds,
    newCoins: row.new_coins,
    newDiamonds: row.new_diamonds,
    alreadyProcessed: row.already_processed,
  };
}

// ─── Read models ──────────────────────────────────────────────────────────

export async function getLedgerHistory(userId: string, limit = 50, offset = 0) {
  const { data, error } = await (supabase.from("financial_ledger" as any) as any)
    .select("id, wallet_type, direction, amount, balance_after, reason, reference_type, reference_id, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

export async function getHostEarnings(hostId: string, limit = 50, offset = 0) {
  const { data, error } = await (supabase.from("host_earnings" as any) as any)
    .select("id, diamonds, status, gift_transaction_id, created_at")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

export async function getAgencyCommissions(agencyId: string, limit = 50, offset = 0) {
  const { data, error } = await (supabase.from("agency_commissions" as any) as any)
    .select("id, host_id, commission_diamonds, rate_applied, gift_transaction_id, payout_id, created_at")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

export async function getUserWithdrawals(userId: string) {
  const { data, error } = await (supabase.from("withdrawals" as any) as any)
    .select("id, currency, amount, status, requested_at, processed_at, note, admin_note")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listPendingWithdrawals() {
  const { data, error } = await (supabase.from("withdrawals" as any) as any)
    .select("id, user_id, currency, amount, status, requested_at, bank_account, upi_id, note, profiles!user_id(name, handle)")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
