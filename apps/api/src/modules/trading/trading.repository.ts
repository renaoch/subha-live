// Durable Postgres access for the Agency Trading Center.
//
// agencies / agency_hosts / profiles are in the generated database.types.ts;
// agency_trading_accounts / agency_trading_ledger / agency_host_payments
// post-date it, so those go through an untyped view (same convention as
// pk.repository.ts).

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type {
  HostVerification,
  TradingAccount,
  TradingAgency,
  TradingLedgerEntry,
} from "./trading.types";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

/** Resolve the active agency OWNED by `userId`, or null. */
export async function resolveOwnedActiveAgency(userId: string): Promise<TradingAgency | null> {
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, code, owner_id")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    ownerId: data.owner_id,
  };
}

export async function assertPlatformAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.is_admin) {
    throw new AppError(403, "Admin permission required", { code: "ADMIN_REQUIRED" });
  }
}

/** Get (or lazily create, at 0) the trading account for an agency. */
export async function getOrCreateAccount(agencyId: string): Promise<TradingAccount> {
  const { error: insertError } = await db
    .from("agency_trading_accounts")
    .upsert({ agency_id: agencyId, available_balance: 0 }, { onConflict: "agency_id", ignoreDuplicates: true });

  if (insertError) {
    throw new AppError(500, "Failed to prepare trading account", {
      code: "TRADING_ACCOUNT_FAILED",
      details: insertError.message,
    });
  }

  const { data, error } = await db
    .from("agency_trading_accounts")
    .select("agency_id, available_balance, created_at, updated_at")
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError(500, "Failed to load trading account", {
      code: "TRADING_ACCOUNT_FAILED",
      details: error?.message,
    });
  }

  return {
    agencyId: data.agency_id,
    availableBalance: toNumber(data.available_balance),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listLedger(agencyId: string, limit: number, offset: number): Promise<TradingLedgerEntry[]> {
  const { data, error } = await db
    .from("agency_trading_ledger")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError(500, "Failed to load trading activity", {
      code: "TRADING_LEDGER_FAILED",
      details: error.message,
    });
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    transactionType: row.transaction_type as TradingLedgerEntry["transactionType"],
    direction: row.direction as TradingLedgerEntry["direction"],
    amount: toNumber(row.amount),
    balanceBefore: toNumber(row.balance_before),
    balanceAfter: toNumber(row.balance_after),
    referenceType: (row.reference_type as string | null) ?? null,
    referenceId: (row.reference_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }));
}

interface HostLookupRow {
  id: string;
  public_id: string | null;
  name: string;
  handle: string;
  avatar: string | null;
  is_verified: boolean;
  role: string;
}

/** Look up a host by public_id OR handle (never by internal uuid). */
export async function lookupHost(publicIdOrHandle: string): Promise<HostLookupRow | null> {
  // Parameterized .eq/.ilike (no PostgREST filter-string concatenation, so the
  // user-supplied id can't inject extra filter conditions).
  const trimmed = publicIdOrHandle.trim();

  const { data: byPublicId, error: publicError } = await supabase
    .from("profiles")
    .select("id, public_id, name, handle, avatar, is_verified, role")
    .eq("public_id", trimmed)
    .limit(1)
    .maybeSingle();

  if (publicError) return null;
  if (byPublicId) return byPublicId as HostLookupRow;

  const { data: byHandle, error: handleError } = await supabase
    .from("profiles")
    .select("id, public_id, name, handle, avatar, is_verified, role")
    .ilike("handle", trimmed)
    .limit(1)
    .maybeSingle();

  if (handleError) return null;
  return (byHandle as HostLookupRow | null) ?? null;
}

export async function isApprovedMember(agencyId: string, hostId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("agency_hosts")
    .select("host_id")
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function creditTradingAccount(input: {
  agencyId: string;
  amount: number;
  referenceType: string;
  referenceId: string | null;
}): Promise<number> {
  const { data, error } = await db.rpc("fin_agency_trading_credit", {
    p_agency_id: input.agencyId,
    p_amount: input.amount,
    p_reference_type: input.referenceType,
    p_reference_id: input.referenceId,
    p_metadata: {},
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return toNumber((row as { new_balance?: number })?.new_balance);
}

export async function payHostTransaction(input: {
  agencyId: string;
  hostId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<{ paymentId: string; newBalance: number; alreadyProcessed: boolean }> {
  const { data, error } = await db.rpc("fin_agency_pay_host", {
    p_agency_id: input.agencyId,
    p_host_id: input.hostId,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as {
    payment_id?: string;
    new_balance?: number;
    already_processed?: boolean;
  };

  return {
    paymentId: String(row.payment_id ?? ""),
    newBalance: toNumber(row.new_balance),
    alreadyProcessed: Boolean(row.already_processed),
  };
}

export function toHostVerification(
  row: HostLookupRow,
  isHost: boolean,
  isAgencyMember: boolean,
): HostVerification {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    handle: row.handle,
    avatar: row.avatar,
    isVerified: Boolean(row.is_verified),
    isHost,
    isAgencyMember,
    eligible: isAgencyMember,
  };
}
