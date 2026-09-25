import { z } from "zod";

/** Absolute upper bound on a single coin amount (integer, bigint-safe). */
export const MAX_COIN_AMOUNT = 9_000_000_000;

/** A positive integer coin amount. Rejects NaN, Infinity, decimals, 0, negatives. */
const coinAmount = z
  .number()
  .int()
  .positive()
  .max(MAX_COIN_AMOUNT, "Amount is too large");

export const verifyHostSchema = z.object({
  hostId: z.string().min(1).max(64),
});

export type VerifyHostInput = z.infer<typeof verifyHostSchema>;

export const payHostSchema = z.object({
  hostId: z.string().min(1).max(64),
  amount: coinAmount,
  idempotencyKey: z.string().min(8).max(128),
});

export type PayHostInput = z.infer<typeof payHostSchema>;

export const creditSchema = z.object({
  agencyId: z.string().min(1).max(64),
  amount: coinAmount,
  referenceType: z.string().min(1).max(64).optional(),
  referenceId: z.string().max(128).optional(),
});

export type CreditInput = z.infer<typeof creditSchema>;

export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
