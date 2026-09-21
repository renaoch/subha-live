import { z } from "zod";

// Client sends only an identity + an idempotency key. Price, coin amount,
// diamond amount are looked up server-side from gift_catalog — never
// accepted from the request body.
export const sendGiftSchema = z.object({
  recipientId: z.string().uuid(),
  giftId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  // Required: the client generates one id per tap/attempt and reuses the
  // SAME id on retry. This is what makes double-taps and network retries
  // safe — see fin_send_gift()'s unique(sender_id, client_request_id).
  clientRequestId: z.string().min(8).max(128),
});
export type SendGiftInput = z.infer<typeof sendGiftSchema>;

// Payment provider webhook. amountUsd/coins here are the provider's
// reported values for *recording* the transaction — the actual coin
// package price should still be cross-checked against a known package
// server-side before calling confirmPayment (done in wallet.service.ts).
export const paymentWebhookSchema = z.object({
  userId: z.string().uuid(),
  provider: z.string().min(1),
  providerTransactionId: z.string().min(1),
  packageId: z.string().optional(),
  amountUsd: z.coerce.number().nonnegative(),
  coins: z.coerce.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

export const withdrawalRequestSchema = z.object({
  currency: z.enum(["coins", "diamonds"]),
  amount: z.number().int().positive(),
  bankAccount: z.string().optional(),
  upiId: z.string().optional(),
  note: z.string().optional(),
  clientRequestId: z.string().min(8).max(128),
});
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;

export const processWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().optional(),
});
export type ProcessWithdrawalInput = z.infer<typeof processWithdrawalSchema>;

export const offlineRechargeDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  coins: z.number().int().nonnegative().optional(),
  diamonds: z.number().int().nonnegative().optional(),
});
export type OfflineRechargeDecisionInput = z.infer<typeof offlineRechargeDecisionSchema>;

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CONTRIBUTOR_PERIODS = ["daily", "weekly", "monthly", "overall"] as const;
export type ContributorPeriod = (typeof CONTRIBUTOR_PERIODS)[number];

export const hostContributorsParamsSchema = z.object({
  hostId: z.string().uuid(),
});

export const hostContributorsQuerySchema = z.object({
  period: z.enum(CONTRIBUTOR_PERIODS).default("daily"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});