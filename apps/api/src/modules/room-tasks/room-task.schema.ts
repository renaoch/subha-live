import { z } from "zod";

export const setRoomTaskSchema = z.object({
  title: z.string().min(1).max(80),
  targetValue: z.coerce.number().int().positive().max(1_000_000_000),
  // Optional so existing "goal only, no reward" callers keep working.
  rewardCoins: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
});

export type SetRoomTaskInput = z.infer<typeof setRoomTaskSchema>;

export const bumpRoomTaskSchema = z.object({
  amount: z.coerce.number().int().positive(),
});

export type BumpRoomTaskInput = z.infer<typeof bumpRoomTaskSchema>;

export const createStarTargetTemplateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  targetValue: z.coerce.number().int().positive().max(1_000_000_000),
  rewardCoins: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  /** Omit / null = applies to every live. A profile id = only that host's rooms. */
  hostId: z.string().uuid().nullable().optional(),
});

export type CreateStarTargetTemplateInput = z.infer<typeof createStarTargetTemplateSchema>;