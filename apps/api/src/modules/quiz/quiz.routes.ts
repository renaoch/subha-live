import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  createQuiz,
  joinQuiz,
  setQuizReady,
  startQuiz,
  answerQuiz,
  cancelQuiz,
  getQuiz,
} from "./quiz.controller";

const router = Router();

router.post("/quiz", authMiddleware, createQuiz);
router.post("/quiz/:sessionId/join", authMiddleware, joinQuiz);
router.post("/quiz/:sessionId/ready", authMiddleware, setQuizReady);
router.post("/quiz/:sessionId/start", authMiddleware, startQuiz);
router.post("/quiz/:sessionId/answer", authMiddleware, answerQuiz);
router.post("/quiz/:sessionId/cancel", authMiddleware, cancelQuiz);
router.get("/quiz/:sessionId", authMiddleware, getQuiz);

export default router;
