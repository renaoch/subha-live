import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";

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

export async function approveRecharge(
  adminId: string,
  rechargeId: string,
  payload: { status: "approved" | "rejected"; coins?: number; diamonds?: number }
) {
  // 1. Fetch the request
  const { data: recharge, error: fetchError } = await supabase
    .from("offline_recharges")
    .select("*, user_id, amount_usd, status")
    .eq("id", rechargeId)
    .single();

  if (fetchError) throw fetchError;
  if (!recharge) throw new AppError(404, "Recharge request not found");
  if (recharge.status !== "pending") {
    throw new AppError(409, "Request already processed");
  }

  // 2. If approved, credit user
  let coinsToAdd = 0;
  let diamondsToAdd = 0;
  if (payload.status === "approved") {
    coinsToAdd = payload.coins ?? Math.floor(recharge.amount_usd * 100);
    diamondsToAdd = payload.diamonds ?? 0;

    // Get current user balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("coins, diamonds")
      .eq("id", recharge.user_id)
      .single();

    if (profileError) throw profileError;

    const newCoins = (profile.coins || 0) + coinsToAdd;
    const newDiamonds = (profile.diamonds || 0) + diamondsToAdd;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: newCoins, diamonds: newDiamonds })
      .eq("id", recharge.user_id);

    if (updateError) throw updateError;
  }

  // 3. Update recharge status and coins_credited
  const updatePayload: any = {
    status: payload.status,
  };
  if (payload.status === "approved") {
    updatePayload.coins_credited = coinsToAdd;
    // Table doesn't have diamonds_credited, but we can add later if needed
  }

  const { error: updateRechargeError } = await supabase
    .from("offline_recharges")
    .update(updatePayload)
    .eq("id", rechargeId);

  if (updateRechargeError) throw updateRechargeError;

  // 4. Audit
  await logAudit({
    actorId: adminId,
    action: `OFFLINE_RECHARGE_${payload.status.toUpperCase()}`,
    entityType: "offline_recharges",
    entityId: rechargeId,
    newValue: { ...payload, coins: coinsToAdd, diamonds: diamondsToAdd },
  });

  return { success: true };
}