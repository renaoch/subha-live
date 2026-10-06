// Round state machine for solo Teen Patti. Pure functions over an immutable
// state object so it is trivial to test and to drive from React.
//
//   idle ──deal──▶ dealt ──reveal──▶ revealed
//     ▲              │                  │
//     └──────────── playAgain ◀─────────┘
//
// Player index 0 is the human; 1..4 are the opponents.

import { dealHands, shuffledDeck, type Card } from "./cards";
import { compareHands, evaluateHand, explainWin, findWinners, type HandEval } from "./evaluator";
import { generateOpponents, OPPONENT_COUNT, type OpponentProfile } from "./opponents";
import type { Rng } from "./rng";

export const PLAYER_COUNT = OPPONENT_COUNT + 1;
export const HUMAN = 0;

export type Phase = "idle" | "dealt" | "revealed";

export interface RoundResult {
  evals: HandEval[];
  winners: number[];
  isTie: boolean;
  humanWon: boolean;
  /** Player indices sorted best → worst (ties keep seat order). */
  standings: number[];
  explanation: string;
}

export interface GameState {
  sessionId: number;
  profiles: OpponentProfile[];
  phase: Phase;
  roundNumber: number;
  hands: Card[][] | null;
  result: RoundResult | null;
}

export class InvalidTransitionError extends Error {
  constructor(action: string, phase: Phase) {
    super(`Cannot ${action} while the round is "${phase}"`);
    this.name = "InvalidTransitionError";
  }
}

export function createGame(rng: Rng, sessionId = 1): GameState {
  return {
    sessionId,
    profiles: generateOpponents(rng, OPPONENT_COUNT, `s${sessionId}-`),
    phase: "idle",
    roundNumber: 1,
    hands: null,
    result: null,
  };
}

/** Fresh table: new opponents, round counter restarts. */
export function newTable(state: GameState, rng: Rng): GameState {
  return createGame(rng, state.sessionId + 1);
}

export function deal(state: GameState, rng: Rng): GameState {
  if (state.phase !== "idle") throw new InvalidTransitionError("deal", state.phase);
  const hands = dealHands(shuffledDeck(rng), PLAYER_COUNT, 3);
  return { ...state, phase: "dealt", hands, result: null };
}

export function evaluateRound(hands: readonly Card[][]): RoundResult {
  const evals = hands.map((h) => evaluateHand(h));
  const winners = findWinners(evals);
  const standings = evals
    .map((_, i) => i)
    .sort((a, b) => compareHands(evals[b], evals[a]) || a - b);
  return {
    evals,
    winners,
    isTie: winners.length > 1,
    humanWon: winners.includes(HUMAN),
    standings,
    explanation: explainWin(evals, winners),
  };
}

export function reveal(state: GameState): GameState {
  if (state.phase !== "dealt" || !state.hands) throw new InvalidTransitionError("reveal", state.phase);
  return { ...state, phase: "revealed", result: evaluateRound(state.hands) };
}

export function playAgain(state: GameState): GameState {
  if (state.phase === "idle") throw new InvalidTransitionError("play again", state.phase);
  return { ...state, phase: "idle", roundNumber: state.roundNumber + 1, hands: null, result: null };
}