import { z } from "zod";

export const quizCreateSchema = z.object({
  roomId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(8).optional(),
});

export const quizSessionIdSchema = z.object({
  sessionId: z.string().min(1).max(120),
});

export const quizReadySchema = z.object({
  ready: z.boolean(),
});

export const quizAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  optionIndex: z.number().int().min(0).max(7),
});
