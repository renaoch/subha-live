import { z } from "zod";

export const taskIdSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Task ID is required")
    .max(100, "Task ID is too long"),
});

export type TaskIdParams = z.infer<
  typeof taskIdSchema
>;

export const adminCreateTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  durationType: z
    .enum(["daily", "weekly", "one_time"])
    .default("daily"),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  targetCount: z.number().int().positive().max(1_000_000).default(1),
  rewardCoins: z.number().int().min(0).max(10_000_000).default(0),
  rewardDiamonds: z.number().int().min(0).max(10_000_000).default(0),
  rewardExp: z.number().int().min(0).max(10_000_000).default(0),
  targetGender: z.enum(["all", "male", "female"]).default("all"),
  status: z.enum(["active", "inactive"]).default("active"),
  expiryDate: z.string().trim().min(1).max(64).optional().nullable(),
});

export const adminUpdateTaskSchema = adminCreateTaskSchema.partial();

export type AdminCreateTaskInput = z.infer<typeof adminCreateTaskSchema>;
export type AdminUpdateTaskInput = z.infer<typeof adminUpdateTaskSchema>;