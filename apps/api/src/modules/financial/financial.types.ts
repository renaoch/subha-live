// File: apps/api/src/modules/financial/financial.types.ts
//
// Hand-written row types for the tables/functions introduced by
// supabase/migrations/20260903120000_financial_system.sql.
//
// TODO: once that migration has been applied to the project's Supabase
// instance, regenerate apps/api/src/types/database.types.ts (same as the
// existing TODO in charisma.service.ts for `gifts.room_id`) and these can
// be deleted in favour of the generated `Database["public"]["Tables"]...`
// types. Until then we cast supabase.from(...) calls with `as any`, same
// convention already used throughout agency.service.ts for tables added
// ahead of a types regen.

export type Currency = "coins" | "diamonds";

export interface GiftCatalogItem {
  id: string;
  code: string;
  name: string;
  icon: string;
  coinPrice: number;
  diamondValue: number;
  isActive: boolean;
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

export interface ConfirmPaymentResult {
  transactionId: string;
  newCoins: number;
  alreadyProcessed: boolean;
}

export interface RequestWithdrawalResult {
  withdrawalId: string;
  newBalance: number;
  status: string;
  alreadyProcessed: boolean;
}

export interface ProcessWithdrawalResult {
  withdrawalId: string;
  status: string;
  refundedBalance: number;
  alreadyProcessed: boolean;
}

export interface CreditOfflineRechargeResult {
  rechargeId: string;
  status: string;
  newCoins: number;
  newDiamonds: number;
  alreadyProcessed: boolean;
}

export interface ClaimAgencyTaskRewardResult {
  rewardCoins: number;
  rewardDiamonds: number;
  newCoins: number;
  newDiamonds: number;
  alreadyProcessed: boolean;
}
