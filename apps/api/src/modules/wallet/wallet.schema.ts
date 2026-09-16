import { z } from "zod";

export const purchasePackageSchema = z.object({
  packageId: z.string().min(1, "Package ID is required"),
});

export const cryptoVerifySchema = z.object({
  packageId: z.string().min(1, "Package ID is required"),
  txId: z.string().min(6, "Transaction ID looks too short").max(128),
});

export const withdrawalRequestSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  bankAccount: z.string().optional(),
  upiId: z.string().optional(),
  note: z.string().optional(),
  // Idempotency key: reuse the same value on retry so a double-submit
  // (double-tap, network retry) can never create two withdrawals.
  clientRequestId: z.string().min(8).max(128).optional(),
});