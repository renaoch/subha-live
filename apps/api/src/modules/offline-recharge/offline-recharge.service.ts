import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { assertIsPlatformAdmin, creditOfflineRecharge } from "../financial/financial.service";

/* -------------------------------------------------------------------------- */
/* USER REQUEST                                                               */
/* -------------------------------------------------------------------------- */

export async function requestOfflineRecharge(
  userId: string,
  payload: {
    amountUsd: number;
    paymentMethod: string;
    transactionRef: string;
    note?: string;
  }
) {
  const { amountUsd, paymentMethod, transactionRef, note } = payload;

  const { data, error } = await supabase
    .from("offline_recharges")
    .insert({
      id: randomUUID(), // generate UUID for primary key
      user_id: userId,
      amount_usd: amountUsd,
      payment_method: paymentMethod,
      transaction_ref: transactionRef,
      status: "pending",
      coins_credited: 0, // placeholder, updated on approval
    })
    .select("id")
    .single();

  if (error) throw error;

  await logAudit({
    actorId: userId,
    action: "OFFLINE_RECHARGE_REQUESTED",
    entityType: "offline_recharges",
    entityId: data.id,
    newValue: { ...payload, note: note || undefined },
  });

  return data;
}

/* -------------------------------------------------------------------------- */
/* USER HISTORY                                                               */
/* -------------------------------------------------------------------------- */

export async function getUserRecharges(userId: string) {
  const { data, error } = await supabase
    .from("offline_recharges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------- */
/* ADMIN / AGENCY OWNER – LIST PENDING                                       */
/* -------------------------------------------------------------------------- */

export async function listPendingRecharges(adminId: string) {
  await assertIsPlatformAdmin(adminId);

  const { data, error } = await supabase
    .from("offline_recharges")
    .select("*, profiles!user_id(name, handle)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------- */
/* APPROVE / REJECT                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Approve or reject a pending offline recharge.
 *
 * SECURITY: previously any authenticated user could call this (no admin
 * check existed) and credit arbitrary coins/diamonds to any account —
 * that gap is closed here with assertIsPlatformAdmin().
 *
 * The actual crediting is delegated to
 * financial.service.ts#creditOfflineRecharge, which calls
 * fin_credit_offline_recharge(): it locks the recharge row, verifies it's
 * still 'pending', and credits coins/diamonds atomically in the same
 * transaction as the status flip — so double-clicking "approve" (or a
 * retried request) can only ever credit once.
 */
export async function approveRecharge(
  adminId: string,
  rechargeId: string,
  payload: { status: "approved" | "rejected"; coins?: number; diamonds?: number }
) {
  await assertIsPlatformAdmin(adminId);

  let coinsToAdd = 0;
  if (payload.status === "approved") {
    const { data: recharge, error: fetchError } = await supabase
      .from("offline_recharges")
      .select("amount_usd")
      .eq("id", rechargeId)
      .single();

    if (fetchError) throw fetchError;
    if (!recharge) throw new AppError(404, "Recharge request not found");

    coinsToAdd = payload.coins ?? Math.floor(recharge.amount_usd * 100);
  }

  const result = await creditOfflineRecharge({
    adminId,
    rechargeId,
    action: payload.status,
    coins: coinsToAdd,
    diamonds: payload.diamonds ?? 0,
  });

  return { success: true, alreadyProcessed: result.alreadyProcessed, newCoins: result.newCoins, newDiamonds: result.newDiamonds };
}