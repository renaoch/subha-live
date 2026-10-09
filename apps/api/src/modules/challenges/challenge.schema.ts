import { z } from "zod";

export const createChallengeSchema = z
  .object({
    title: z.string().trim().min(1).max(40),
    subtitle: z.string().trim().max(40).optional().default("Challenge"),
    /** profiles.country value this challenge is restricted to; omit for all regions. */
    country: z.string().trim().min(1).max(60).nullable().optional(),
    rewardText: z.string().trim().max(120).nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });

export const updateChallengeSchema = z.object({
  isActive: z.boolean().optional(),
  endsAt: z.coerce.date().optional(),
  title: z.string().trim().min(1).max(40).optional(),
  subtitle: z.string().trim().max(40).optional(),
  rewardText: z.string().trim().max(120).nullable().optional(),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;
