import { z } from "zod";

export const createBdApplicationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name is too long"),

    contactNumber: z
      .string()
      .trim()
      .min(5, "Contact number is invalid")
      .max(30, "Contact number is too long"),

    agencyExperience: z
      .string()
      .trim()
      .max(
        1000,
        "Agency experience is too long",
      )
      .nullable()
      .optional(),

    monthlyTargetUsd: z
      .number()
      .min(
        0,
        "Monthly target cannot be negative",
      )
      .max(
        1000000,
        "Monthly target is too large",
      )
      .nullable()
      .optional(),
  })
  .strict();

export type CreateBdApplicationInput =
  z.infer<typeof createBdApplicationSchema>;