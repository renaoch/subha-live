// Built-in question bank for the first Quiz release. Authoring a
// host-editable question set is a deliberately deferred follow-up (see the
// implementation report) — this gets a complete, playable game shipped
// without inventing a content-management surface that wasn't asked for.

import type { QuizQuestion } from "./quiz.types";

export const QUIZ_QUESTION_BANK: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctIndex: 1,
  },
  {
    id: "q2",
    prompt: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctIndex: 3,
  },
  {
    id: "q3",
    prompt: "Which language runs natively in a web browser?",
    options: ["Python", "JavaScript", "C++", "Rust"],
    correctIndex: 1,
  },
  {
    id: "q4",
    prompt: "How many continents are there on Earth?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
  },
  {
    id: "q5",
    prompt: "What is the capital of Japan?",
    options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
    correctIndex: 2,
  },
  {
    id: "q6",
    prompt: "Which gas do plants absorb from the atmosphere?",
    options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    correctIndex: 2,
  },
  {
    id: "q7",
    prompt: "Who wrote Romeo and Juliet?",
    options: [
      "Charles Dickens",
      "William Shakespeare",
      "Leo Tolstoy",
      "Mark Twain",
    ],
    correctIndex: 1,
  },
  {
    id: "q8",
    prompt: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    correctIndex: 2,
  },
];

/** A shuffled, `count`-length subset for one session (Fisher–Yates). */
export function drawQuestions(count: number): QuizQuestion[] {
  const pool = [...QUIZ_QUESTION_BANK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
