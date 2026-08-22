import { z } from "zod";

export const purchasePackageSchema = z.object({
  packageId: z.string().min(1, "Package ID is required"),
});

export const withdrawalRequestSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  bankAccount: z.string().optional(),
  upiId: z.string().optional(),
  note: z.string().optional(),
});