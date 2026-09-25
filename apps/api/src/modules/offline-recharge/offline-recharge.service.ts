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
    agencyId?: string;
  }
) {
  const { amountUsd, paymentMethod, transactionRef, note, agencyId } = payload;

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
      // TODO: remove this cast once database.types.ts is regenerated after
      // 20260906000000_agency_offline_recharge.sql — the generated Insert
      // type doesn't know about `note` yet.
      note: note ?? null,
      // Agency coin purchase: routes the approval to the Trading Market.
      agency_id: agencyId ?? null,
    } as never)
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
/* PLATFORM ADMIN — LIST PENDING / APPROVE                                   */
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

/**
 * Approve or reject a pending offline recharge as a PLATFORM ADMIN.
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

  // Agency coin purchase (recharge tagged with agency_id) credits the agency's
  // Trading Market, not the owner's personal wallet.
  const { data: recharge, error: fetchError } = await supabase
    .from("offline_recharges")
    .select("agency_id, amount_usd, status")
    .eq("id", rechargeId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!recharge) throw new AppError(404, "Recharge request not found", { code: "RECHARGE_NOT_FOUND" });

  if (recharge.agency_id) {
    return approveAgencyTradingPurchase(adminId, rechargeId, recharge.agency_id, recharge.amount_usd, payload);
  }

  return creditRecharge(adminId, rechargeId, payload, null);
}

/**
 * Approve/reject an AGENCY coin purchase: credits the agency's Trading Market
 * (via fin_credit_agency_trading_recharge) instead of the personal wallet.
 */
async function approveAgencyTradingPurchase(
  adminId: string,
  rechargeId: string,
  agencyId: string,
  amountUsd: number,
  payload: { status: "approved" | "rejected"; coins?: number; diamonds?: number }
) {
  if (payload.status === "rejected") {
    const result = await creditAgencyTradingRecharge({
      adminId,
      rechargeId,
      action: "rejected",
      coins: 0,
      agencyId,
    });
    return { success: true, alreadyProcessed: result.alreadyProcessed };
  }

  const coinsToAdd = payload.coins ?? Math.floor(amountUsd * 100);

  const result = await creditAgencyTradingRecharge({
    adminId,
    rechargeId,
    action: "approved",
    coins: coinsToAdd,
    agencyId,
  });

  await logAudit({
    actorId: adminId,
    agencyId,
    action: "AGENCY_COIN_PURCHASE",
    entityType: "offline_recharges",
    entityId: rechargeId,
    newValue: { coins: coinsToAdd, newBalance: result.newBalance, alreadyProcessed: result.alreadyProcessed },
  });

  return {
    success: true,
    alreadyProcessed: result.alreadyProcessed,
    newBalance: result.newBalance,
  };
}

/**
 * Atomic settlement of an agency coin purchase against the Trading Market.
 * Calls fin_credit_agency_trading_recharge() (service-role only) which locks
 * the recharge row, flips its status, and credits the trading account + ledger.
 */
async function creditAgencyTradingRecharge(input: {
  adminId: string;
  rechargeId: string;
  action: "approved" | "rejected";
  coins: number;
  agencyId: string;
}): Promise<{ newBalance: number; alreadyProcessed: boolean }> {
  const { data, error } = await (supabase as any).rpc("fin_credit_agency_trading_recharge", {
    p_recharge_id: input.rechargeId,
    p_admin_id: input.adminId,
    p_action: input.action,
    p_coins: input.coins,
    p_agency_id: input.agencyId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    newBalance: Number(row?.new_balance ?? 0),
    alreadyProcessed: Boolean(row?.already_processed),
  };
}

/* -------------------------------------------------------------------------- */
/* AGENCY OWNER — LIST PENDING / APPROVE (for their own hosts only)          */
/* -------------------------------------------------------------------------- */

/**
 * Returns the id of the active agency owned by `userId`, or throws
 * AppError(404, ..., { code: "AGENCY_NOT_FOUND" }) — same error code the
 * fin_credit_offline_recharge() RPC uses, so failures look identical
 * regardless of which layer catches them first.
 */
async function getOwnedActiveAgencyId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AppError(404, "You do not own an active agency", { code: "AGENCY_NOT_FOUND" });
  }
  return data.id;
}

/**
 * Throws unless `hostId` is an approved host of `agencyId`. Mirrors the
 * status vocabulary used everywhere else in agency.service.ts
 * (agency_hosts.status = 'approved', not 'active' — 'active' is a
 * different table's status value, see agency_agents).
 */
async function assertHostBelongsToAgency(hostId: string, agencyId: string): Promise<void> {
  const { data, error } = await supabase
    .from("agency_hosts")
    .select("host_id")
    .eq("host_id", hostId)
    .eq("agency_id", agencyId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AppError(403, "This host does not belong to your agency", { code: "AGENCY_HOST_MISMATCH" });
  }
}

/**
 * Lists pending offline recharges for hosts that belong to the calling
 * agency owner's agency — never recharges belonging to other agencies or
 * to hosts with no agency at all.
 *
 * Efficient by construction: two indexed lookups (agency_hosts by
 * (agency_id, status), then offline_recharges by (status, user_id) via an
 * IN clause), not a scan or an N+1 — see the indexes added in
 * 20260906000000_agency_offline_recharge.sql. Agency host counts are
 * small (tens to low hundreds), so a single IN-clause round trip is both
 * simple and fast; a fancier single-query embedded join buys nothing at
 * this scale and is harder to reason about.
 */
export async function listPendingRechargesForAgency(agencyOwnerId: string) {
  const agencyId = await getOwnedActiveAgencyId(agencyOwnerId);

  const { data: hostRows, error: hostError } = await supabase
    .from("agency_hosts")
    .select("host_id")
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (hostError) throw hostError;

  const hostIds = (hostRows ?? []).map((r) => r.host_id);
  if (hostIds.length === 0) return [];

  const { data, error } = await supabase
    .from("offline_recharges")
    .select("*, profiles!user_id(name, handle)")
    .eq("status", "pending")
    .in("user_id", hostIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Approve or reject a pending offline recharge as an AGENCY OWNER, scoped
 * to hosts in the caller's own agency.
 *
 * Two independent checks before any money moves:
 *   1. Here: the recharge's user_id must be an 'approved' host of the
 *      caller's 'is_active' agency (assertHostBelongsToAgency).
 *   2. Again, inside fin_credit_offline_recharge() itself, via p_agency_id
 *      — so this can never be bypassed by a bug in this function; the DB
 *      is the actual authority.
 */
export async function approveRechargeAsAgency(
  agencyOwnerId: string,
  rechargeId: string,
  payload: { status: "approved" | "rejected"; coins?: number; diamonds?: number }
) {
  const agencyId = await getOwnedActiveAgencyId(agencyOwnerId);

  const { data: recharge, error: fetchError } = await supabase
    .from("offline_recharges")
    .select("user_id, amount_usd, status")
    .eq("id", rechargeId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!recharge) throw new AppError(404, "Recharge request not found", { code: "RECHARGE_NOT_FOUND" });

  if (recharge.status === "pending") {
    // Only enforce membership while there's still something to authorize;
    // an already-processed recharge just returns idempotently below.
    await assertHostBelongsToAgency(recharge.user_id, agencyId);
  }

  return creditRecharge(agencyOwnerId, rechargeId, payload, agencyId, recharge.amount_usd);
}

/* -------------------------------------------------------------------------- */
/* SHARED CREDITING LOGIC (platform admin + agency owner paths converge here)*/
/* -------------------------------------------------------------------------- */

async function creditRecharge(
  actorId: string,
  rechargeId: string,
  payload: { status: "approved" | "rejected"; coins?: number; diamonds?: number },
  agencyId: string | null,
  knownAmountUsd?: number
) {
  let coinsToAdd = 0;
  if (payload.status === "approved") {
    let amountUsd = knownAmountUsd;
    if (amountUsd === undefined) {
      const { data: recharge, error: fetchError } = await supabase
        .from("offline_recharges")
        .select("amount_usd")
        .eq("id", rechargeId)
        .single();

      if (fetchError) throw fetchError;
      if (!recharge) throw new AppError(404, "Recharge request not found", { code: "RECHARGE_NOT_FOUND" });
      amountUsd = recharge.amount_usd;
    }

    coinsToAdd = payload.coins ?? Math.floor(amountUsd * 100);
  }

  const result = await creditOfflineRecharge({
    adminId: actorId,
    rechargeId,
    action: payload.status,
    coins: coinsToAdd,
    diamonds: payload.diamonds ?? 0,
    agencyId,
  });

  return {
    success: true,
    alreadyProcessed: result.alreadyProcessed,
    newCoins: result.newCoins,
    newDiamonds: result.newDiamonds,
  };
}
