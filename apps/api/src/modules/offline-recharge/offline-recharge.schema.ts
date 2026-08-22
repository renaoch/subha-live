import { z } from "zod";

export const requestRechargeSchema = z.object({
  amountUsd: z.number().positive("Amount must be greater than zero"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  transactionRef: z.string().min(1, "Transaction reference is required"),
  note: z.string().optional(),
});

export const approveRechargeSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  coins: z.number().int().nonnegative().optional(),
  diamonds: z.number().int().nonnegative().optional(),
});