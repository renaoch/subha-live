import { z } from "zod";

export const updateMyProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(50, "Name must be 50 characters or less")
      .optional(),

    handle: z
      .string()
      .trim()
      .min(3, "Handle must be at least 3 characters")
      .max(30, "Handle must be 30 characters or less")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Handle can only contain letters, numbers, and underscores"
      )
      .optional(),

    avatar: z
      .string()
      .url("Avatar must be a valid URL")
      .max(500, "Avatar URL is too long")
      .optional(),

    bio: z
      .string()
      .trim()
      .max(500, "Bio must be 500 characters or less")
      .optional(),

    country: z
      .string()
      .trim()
      .max(100, "Country is too long")
      .optional(),

    country_flag: z
      .string()
      .max(10, "Country flag is invalid")
      .optional(),

    gender: z
      .string()
      .max(30, "Gender is too long")
      .nullable()
      .optional(),
  })
  .strict();