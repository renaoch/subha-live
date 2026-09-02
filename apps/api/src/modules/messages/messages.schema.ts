import { z } from "zod";

export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(120),
});

export type UserIdParams = z.infer<typeof userIdParamSchema>;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
