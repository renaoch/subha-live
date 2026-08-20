import { z } from "zod";

export const cpIdParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "CP partnership ID is required")
    .max(100, "CP partnership ID is too long"),
});

export const createCpSchema = z
  .object({
    partnerId: z
      .string()
      .trim()
      .min(1, "Partner ID is required")
      .max(100, "Partner ID is too long"),

    ringName: z
      .string()
      .trim()
      .max(100, "Ring name is too long")
      .nullable()
      .optional(),
  })
  .strict();

export type CreateCpInput =
  z.infer<typeof createCpSchema>;