import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { quizService } from "./quiz.service";
import {
  quizAnswerSchema,
  quizCreateSchema,
  quizReadySchema,
  quizSessionIdSchema,
} from "./quiz.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

function sessionId(req: Request<{ sessionId: string }>): string {
  const parsed = quizSessionIdSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(400, "Invalid session id", { code: "INVALID_QUIZ_SESSION_ID" });
  }
  return parsed.data.sessionId;
}

export async function createQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const input = quizCreateSchema.safeParse(req.body);
    if (!input.success) {
      throw new AppError(400, "Invalid quiz create payload", {
        code: "INVALID_QUIZ_CREATE",
        details: input.error.flatten().fieldErrors,
      });
    }
    const result = await quizService.create(input.data.roomId, user.id, input.data.questionCount);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function joinQuiz(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await quizService.join(sessionId(req), user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function setQuizReady(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const input = quizReadySchema.safeParse(req.body);
    if (!input.success) {
      throw new AppError(400, "Invalid ready payload", { code: "INVALID_QUIZ_READY" });
    }
    await quizService.setReady(sessionId(req), user.id, input.data.ready);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function startQuiz(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await quizService.start(sessionId(req), user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function answerQuiz(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const input = quizAnswerSchema.safeParse(req.body);
    if (!input.success) {
      throw new AppError(400, "Invalid answer payload", {
        code: "INVALID_QUIZ_ANSWER",
        details: input.error.flatten().fieldErrors,
      });
    }
    const result = await quizService.submitAnswer(
      sessionId(req),
      user.id,
      input.data.questionIndex,
      input.data.optionIndex,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function cancelQuiz(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await quizService.cancel(sessionId(req), user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getQuiz(req: Request<{ sessionId: string }>, res: Response, next: NextFunction) {
  try {
    requireUser(req);
    const state = await quizService.getState(sessionId(req));
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}
