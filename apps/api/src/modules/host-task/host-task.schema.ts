import { z } from "zod";

const audienceSchema = z.enum(["all", "new_users", "existing_users"]);
const statusSchema = z.enum(["active", "inactive", "ended"]);

export const createHostTaskSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  audience: audienceSchema.default("all"),
  // Only meaningful when audience is "new_users" / "existing_users"; kept
  // as a plain number of days rather than a duration string so the
  // service can do simple ms-window math against profiles.created_at.
  newUserWindowDays: z.coerce.number().int().positive().max(365).default(7),
  targetHours: z.coerce.number().positive().max(10_000).optional(),
  targetCoins: z.coerce.number().int().positive().max(1_000_000_000).optional(),
  rewardAmount: z.coerce.number().int().min(0).max(1_000_000).default(0),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  maxClaims: z.coerce.number().int().positive().max(1_000_000).optional(),
});

export type CreateHostTaskInput = z.infer<typeof createHostTaskSchema>;

export const updateHostTaskSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  audience: audienceSchema.optional(),
  newUserWindowDays: z.coerce.number().int().positive().max(365).optional(),
  targetHours: z.coerce.number().positive().max(10_000).optional(),
  targetCoins: z.coerce.number().int().positive().max(1_000_000_000).optional(),
  rewardAmount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  maxClaims: z.coerce.number().int().positive().max(1_000_000).optional(),
  status: statusSchema.optional(),
});

export type UpdateHostTaskInput = z.infer<typeof updateHostTaskSchema>;

export const heartbeatSchema = z.object({
  seconds: z.coerce.number().positive().max(24 * 60 * 60),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
