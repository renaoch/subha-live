// File: apps/api/src/modules/financial/financial.logic.ts
//
// Pure, side-effect-free logic for the financial system. The actual
// atomicity/locking/idempotency guarantees live in the SQL functions in
// supabase/migrations/20260903120000_financial_system.sql — this file only
// holds the deterministic math and error-mapping so it can be unit tested
// without a database, same pattern as pk.logic.ts / host-task.logic.ts.

export const DEFAULT_HOST_SHARE_RATE = 0.6;

export interface GiftSplit {
  hostNetDiamonds: number;
  platformShareDiamonds: number;
  agencyCommissionDiamonds: number;
  platformNetDiamonds: number;
}

/**
 * Mirrors the split computed inside fin_send_gift(): the host's share is
 * carved out of the gift's total diamond value first; the agency's
 * commission (if any) then comes out of what's left for the platform, not
 * out of the host's share.
 *
 * agencyCommissionRatePercent is a 0-100 percentage (matches
 * agencies.commission_rate in the DB), not a 0-1 fraction.
 */
export function computeGiftSplit(
  diamondValue: number,
  hostShareRate: number = DEFAULT_HOST_SHARE_RATE,
  agencyCommissionRatePercent = 0
): GiftSplit {
  if (diamondValue < 0) {
    throw new Error("diamondValue must be >= 0");
  }
  if (hostShareRate < 0 || hostShareRate > 1) {
    throw new Error("hostShareRate must be between 0 and 1");
  }

  const hostNetDiamonds = Math.floor(diamondValue * hostShareRate);
  const platformShareDiamonds = diamondValue - hostNetDiamonds;

  let agencyCommissionDiamonds = 0;
  if (agencyCommissionRatePercent > 0) {
    agencyCommissionDiamonds = Math.floor(
      platformShareDiamonds * (agencyCommissionRatePercent / 100)
    );
    if (agencyCommissionDiamonds > platformShareDiamonds) {
      agencyCommissionDiamonds = platformShareDiamonds;
    }
  }

  const platformNetDiamonds = platformShareDiamonds - agencyCommissionDiamonds;

  return {
    hostNetDiamonds,
    platformShareDiamonds: platformNetDiamonds,
    agencyCommissionDiamonds,
    platformNetDiamonds,
  };
}

/** Every value the split produces must reconcile back to the gift's total value. */
export function isGiftSplitBalanced(diamondValue: number, split: GiftSplit): boolean {
  return (
    split.hostNetDiamonds +
      split.platformShareDiamonds +
      split.agencyCommissionDiamonds ===
    diamondValue
  );
}

/** Postgres RAISE EXCEPTION messages -> HTTP status + machine-readable code. */
export const FINANCIAL_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  INVALID_GIFT_RECIPIENT: { status: 400, code: "INVALID_GIFT_RECIPIENT", message: "You cannot send a gift to yourself" },
  INVALID_HOST_SHARE_RATE: { status: 500, code: "INVALID_HOST_SHARE_RATE", message: "Invalid host share configuration" },
  GIFT_NOT_FOUND: { status: 404, code: "GIFT_NOT_FOUND", message: "Gift not found or inactive" },
  GIFT_REQUEST_IN_PROGRESS: { status: 409, code: "GIFT_REQUEST_IN_PROGRESS", message: "This gift request is already being processed" },
  SENDER_NOT_FOUND: { status: 404, code: "SENDER_NOT_FOUND", message: "Sender profile not found" },
  RECIPIENT_NOT_FOUND: { status: 404, code: "RECIPIENT_NOT_FOUND", message: "Recipient profile not found" },
  INSUFFICIENT_BALANCE: { status: 400, code: "INSUFFICIENT_BALANCE", message: "Insufficient coin balance" },
  INSUFFICIENT_COINS: { status: 400, code: "INSUFFICIENT_COINS", message: "Insufficient coin balance" },
  INVALID_CURRENCY: { status: 400, code: "INVALID_CURRENCY", message: "Invalid currency" },
  INVALID_AMOUNT: { status: 400, code: "INVALID_AMOUNT", message: "Amount must be positive" },
  INVALID_COIN_AMOUNT: { status: 400, code: "INVALID_COIN_AMOUNT", message: "Invalid coin amount" },
  INVALID_ACTION: { status: 400, code: "INVALID_ACTION", message: "Invalid action" },
  USER_NOT_FOUND: { status: 404, code: "USER_NOT_FOUND", message: "User not found" },
  RECHARGE_NOT_FOUND: { status: 404, code: "RECHARGE_NOT_FOUND", message: "Recharge request not found" },
  WITHDRAWAL_NOT_FOUND: { status: 404, code: "WITHDRAWAL_NOT_FOUND", message: "Withdrawal not found" },
  TASK_NOT_FOUND: { status: 404, code: "TASK_NOT_FOUND", message: "Task not found" },
  TASK_ASSIGNMENT_NOT_FOUND: { status: 404, code: "TASK_ASSIGNMENT_NOT_FOUND", message: "You are not assigned to this task" },
  TASK_NOT_COMPLETED: { status: 400, code: "TASK_NOT_COMPLETED", message: "Task has not been completed" },
  AGENCY_HOST_MISMATCH: { status: 403, code: "AGENCY_HOST_MISMATCH", message: "This host does not belong to your agency" },
  AGENCY_NOT_FOUND: { status: 404, code: "AGENCY_NOT_FOUND", message: "You do not own an active agency" },
};

/**
 * Postgres wraps our `raise exception 'CODE'` as an error whose `message`
 * is exactly that code (e.g. "INSUFFICIENT_BALANCE"), sometimes with a
 * trailing context string from PostgREST. Extract the code defensively.
 */
export function extractFinancialErrorCode(pgMessage: string | undefined | null): string | null {
  if (!pgMessage) return null;
  const match = Object.keys(FINANCIAL_ERROR_MAP).find((code) => pgMessage.includes(code));
  return match ?? null;
}
