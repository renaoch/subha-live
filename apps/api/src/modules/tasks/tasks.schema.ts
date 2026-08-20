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