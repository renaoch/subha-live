// Agency Trading Center types (Core API side).
//
// agency_trading_accounts / agency_trading_ledger / agency_host_payments
// post-date the last `supabase gen types` run, so these are hand-written
// (same convention as host-task.types.ts / pk.types.ts).

export type TradingTransactionType =
  | "AGENCY_COIN_PURCHASE"
  | "HOST_PAYMENT"
  | "ADJUSTMENT"
  | "REVERSAL";

export type TradingDirection = "credit" | "debit";

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
