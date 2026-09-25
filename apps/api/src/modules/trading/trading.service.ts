// Agency Trading Center service (Core API).
//
// Authorization is derived from the authenticated user, never from the client:
//   - an Agency Owner resolves their own active agency server-side;
//   - a platform admin may credit the trading market (agency coin purchase);
//   - nobody may pass an arbitrary agency_id to read or spend another agency's
//     balance.
//
// All money movement goes through fin_agency_trading_credit() /
// fin_agency_pay_host() (atomic + idempotent). The service only verifies
// eligibility and maps errors.

import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { validateAmount } from "./trading.logic";
import {
  assertPlatformAdmin,
  creditTradingAccount,
  getOrCreateAccount,
  isApprovedMember,
  listLedger,
  lookupHost,
  payHostTransaction,
  resolveOwnedActiveAgency,
  toHostVerification,
} from "./trading.repository";
import type {
  HostPaymentResult,
  HostVerification,
  TradingLedgerEntry,
  TradingOverview,
} from "./trading.types";

const TRADING_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  AGENCY_NOT_FOUND: { status: 404, code: "AGENCY_NOT_FOUND", message: "Agency not found" },
  INVALID_AMOUNT: { status: 400, code: "INVALID_AMOUNT", message: "Amount must be a positive whole number" },
  INSUFFICIENT_TRADING_BALANCE: { status: 400, code: "INSUFFICIENT_TRADING_BALANCE", message: "Insufficient trading balance" },
  HOST_NOT_FOUND: { status: 404, code: "HOST_NOT_FOUND", message: "Host not found" },
};

function extractCode(message: string | undefined | null): string | null {
  if (!message) return null;
  const match = Object.keys(TRADING_ERROR_MAP).find((code) => message.includes(code));
  return match ?? null;
}

function throwMappedError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = extractCode(message);
  if (code) {
    const mapped = TRADING_ERROR_MAP[code];
    throw new AppError(mapped.status, mapped.message, { code: mapped.code });
  }
  throw new AppError(500, fallback, { code: "TRADING_OPERATION_FAILED", details: message });
}

/** Resolve the caller's owned, active agency. Throws for non-owners. */
async function requireOwnedAgency(userId: string) {
  const agency = await resolveOwnedActiveAgency(userId);
  if (!agency) {
    throw new AppError(403, "You do not own an active agency", {
      code: "AGENCY_OWNER_REQUIRED",
    });
  }
  return agency;
}

export const tradingService = {
  /** Trading balance + agency identity (Trading tab header). */
  async getOverview(userId: string): Promise<TradingOverview> {
    const agency = await requireOwnedAgency(userId);
    const account = await getOrCreateAccount(agency.id);
    return { agency, account };
  },

  /** Recent trading ledger entries for the caller's agency. */
  async listTransactions(userId: string, limit: number, offset: number): Promise<TradingLedgerEntry[]> {
    const agency = await requireOwnedAgency(userId);
    return listLedger(agency.id, limit, offset);
  },

  /** Verify a host by public ID (host-facing, never an internal uuid). */
  async verifyHost(userId: string, hostId: string): Promise<HostVerification> {
    const agency = await requireOwnedAgency(userId);

    const host = await lookupHost(hostId.trim());
    if (!host) {
      throw new AppError(404, "Host not found", { code: "HOST_NOT_FOUND" });
    }

    const isAgencyMember = await isApprovedMember(agency.id, host.id);
    const isHost = isAgencyMember || host.role === "agency_host";
    return toHostVerification(host, isHost, isAgencyMember);
  },

  /** Pay an eligible host from the agency's trading balance (atomic). */
  async payHost(
    userId: string,
    input: { hostId: string; amount: number; idempotencyKey: string },
  ): Promise<HostPaymentResult> {
    const agency = await requireOwnedAgency(userId);

    const account = await getOrCreateAccount(agency.id);
    const validated = validateAmount(input.amount, account.availableBalance);
    if (!validated.ok) {
      if (validated.reason === "insufficient") {
        throw new AppError(400, "Insufficient trading balance", { code: "INSUFFICIENT_TRADING_BALANCE" });
      }
      throw new AppError(400, "Amount must be a positive whole number", { code: "INVALID_AMOUNT" });
    }

    // Re-verify the host server-side — never trust the earlier verification.
    const host = await lookupHost(input.hostId.trim());
    if (!host) {
      throw new AppError(404, "Host not found", { code: "HOST_NOT_FOUND" });
    }
    if (host.id === userId) {
      throw new AppError(400, "You cannot pay yourself", { code: "SELF_PAYMENT_FORBIDDEN" });
    }
    const isMember = await isApprovedMember(agency.id, host.id);
    if (!isMember) {
      throw new AppError(403, "This host is not eligible for agency payments", {
        code: "HOST_NOT_ELIGIBLE",
      });
    }

    try {
      const result = await payHostTransaction({
        agencyId: agency.id,
        hostId: host.id,
        amount: validated.amount,
        idempotencyKey: input.idempotencyKey,
      });

      await logAudit({
        actorId: userId,
        agencyId: agency.id,
        action: "AGENCY_HOST_PAYMENT",
        entityType: "agency_host_payments",
        entityId: result.paymentId,
        newValue: {
          hostId: host.id,
          amount: validated.amount,
          newBalance: result.newBalance,
          alreadyProcessed: result.alreadyProcessed,
        },
      });

      return {
        paymentId: result.paymentId,
        amount: validated.amount,
        newBalance: result.newBalance,
        alreadyProcessed: result.alreadyProcessed,
        hostId: host.id,
      };
    } catch (error) {
      throwMappedError(error, "Payment failed");
    }
  },

  /** Admin-only: credit an agency's trading market (agency coin purchase). */
  async credit(
    adminId: string,
    input: { agencyId: string; amount: number; referenceType?: string; referenceId?: string },
  ): Promise<number> {
    await assertPlatformAdmin(adminId);

    const validated = validateAmount(input.amount);
    if (!validated.ok) {
      throw new AppError(400, "Amount must be a positive whole number", { code: "INVALID_AMOUNT" });
    }

    // Ensure the agency exists before the RPC (gives a clean 404 vs FK error).
    const agency = await resolveAgencyById(input.agencyId);

    try {
      const newBalance = await creditTradingAccount({
        agencyId: agency.id,
        amount: validated.amount,
        referenceType: input.referenceType ?? "AGENCY_COIN_PURCHASE",
        referenceId: input.referenceId ?? null,
      });

      await logAudit({
        actorId: adminId,
        agencyId: agency.id,
        action: "AGENCY_COIN_PURCHASE",
        entityType: "agency_trading_accounts",
        entityId: agency.id,
        newValue: { amount: validated.amount, newBalance },
      });

      return newBalance;
    } catch (error) {
      throwMappedError(error, "Failed to credit trading balance");
    }
  },
};

async function resolveAgencyById(agencyId: string) {
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, code, owner_id")
    .eq("id", agencyId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError(404, "Agency not found", { code: "AGENCY_NOT_FOUND" });
  }

  return { id: data.id, name: data.name, code: data.code, ownerId: data.owner_id };
}
