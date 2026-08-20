import { z } from "zod";

export const familyIdParamsSchema =
  z.object({
    id: z
      .string()
      .trim()
      .min(1, "Family ID is required")
      .max(100, "Family ID is too long"),
  });

export const createFamilySchema =
  z
    .object({
      id: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Family ID can only contain letters, numbers, underscores, and hyphens",
        ),

      name: z
        .string()
        .trim()
        .min(1)
        .max(100),

      badge_text: z
        .string()
        .trim()
        .min(1)
        .max(50),

      logo_url: z
        .string()
        .url()
        .max(500)
        .nullable()
        .optional(),

      announcement: z
        .string()
        .trim()
        .max(500)
        .nullable()
        .optional(),

      max_members: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional(),
    })
    .strict();

export type CreateFamilyInput =
  z.infer<typeof createFamilySchema>;