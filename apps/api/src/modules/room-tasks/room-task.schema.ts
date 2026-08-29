import { z } from "zod";

export const setRoomTaskSchema = z.object({
  title: z.string().min(1).max(80),
  targetValue: z.coerce.number().int().positive().max(1_000_000_000),
});

export type SetRoomTaskInput = z.infer<typeof setRoomTaskSchema>;

export const bumpRoomTaskSchema = z.object({
  amount: z.coerce.number().int().positive(),
});

export type BumpRoomTaskInput = z.infer<typeof bumpRoomTaskSchema>;
