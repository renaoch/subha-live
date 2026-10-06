// Pure Teen Patti hand evaluation. No UI, no randomness.
//
// Ruleset (standard 3-card, no jokers):
//   1 Trail (three of a kind)   AAA highest … 222 lowest
//   2 Pure sequence (straight flush)
//   3 Sequence (run, mixed suits)
//     Sequence order: A-K-Q (highest) > A-2-3 > K-Q-J > … > 4-3-2 (lowest).
//     Q-K-A is A-K-Q; K-A-2 does NOT wrap and is not a sequence.
//   4 Color (flush)             compared by highest card, then 2nd, then 3rd
//   5 Pair                      pair rank, then the kicker
//   6 High card                 highest, 2nd, 3rd
// Suits never break ties: identical rank-values tie and the pot is split.

import { rankLabel, rankName, type Card, type Rank } from "./cards";

export enum HandCategory {
  HighCard = 1,
  Pair = 2,
  Color = 3,
  Sequence = 4,
  PureSequence = 5,
  Trail = 6,
}

export const CATEGORY_LABEL: Record<HandCategory, string> = {
  [HandCategory.Trail]: "Trail (Three of a Kind)",
  [HandCategory.PureSequence]: "Pure Sequence",
  [HandCategory.Sequence]: "Sequence (Run)",
  [HandCategory.Color]: "Color (Flush)",
  [HandCategory.Pair]: "Pair",
  [HandCategory.HighCard]: "High Card",
};

export const CATEGORY_SHORT: Record<HandCategory, string> = {
  [HandCategory.Trail]: "Trail",
  [HandCategory.PureSequence]: "Pure Sequence",
  [HandCategory.Sequence]: "Sequence",
  [HandCategory.Color]: "Color",
  [HandCategory.Pair]: "Pair",
  [HandCategory.HighCard]: "High Card",
};

/** Categories best → worst, for the ranking panel. */
export const CATEGORY_ORDER: readonly HandCategory[] = [
  HandCategory.Trail,
  HandCategory.PureSequence,
  HandCategory.Sequence,
  HandCategory.Color,
  HandCategory.Pair,
  HandCategory.HighCard,
];

export interface HandEval {
  category: HandCategory;
  /** Tie-break values, compared left to right after category. */
  values: number[];
  /** Cards ordered strongest-first (the order they read in the hand). */
  cards: Card[];
  /** e.g. "Pair of Kings", "Sequence A-K-Q". */
  name: string;
}

/** Sequence strength: A-K-Q = 15, A-2-3 = 14, otherwise the top card (K=13 … 4=4). */
function sequenceStrength(ranks: number[]): number | null {
  const sorted = [...ranks].sort((a, b) => b - a);
  const [hi, mid, lo] = sorted;
  if (hi === 14 && mid === 13 && lo === 12) return 15;
  if (hi === 14 && mid === 3 && lo === 2) return 14;
  if (hi - mid === 1 && mid - lo === 1) return hi;
  return null;
}

function sortByRankDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}

export function evaluateHand(hand: readonly Card[]): HandEval {
  if (hand.length !== 3) throw new Error(`A Teen Patti hand has exactly 3 cards (got ${hand.length})`);
  const cards = sortByRankDesc([...hand]);
  const ranks = cards.map((c) => c.rank as number);
  const sameSuit = cards.every((c) => c.suit === cards[0].suit);
  const seq = sequenceStrength(ranks);

  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return {
      category: HandCategory.Trail,
      values: [ranks[0]],
      cards,
      name: `Trail of ${rankName(cards[0].rank, true)}`,
    };
  }

  if (seq !== null) {
    // Present A-2-3 as A,2,3 (sorted high-first it would read A,3,2).
    const lowAce = seq === 14;
    const orderedCards = lowAce ? [cards[0], cards[2], cards[1]] : cards;
    const labels = orderedCards.map((c) => rankLabel(c.rank)).join("-");
    return {
      category: sameSuit ? HandCategory.PureSequence : HandCategory.Sequence,
      values: [seq],
      cards: orderedCards,
      name: `${sameSuit ? "Pure Sequence" : "Sequence"} ${labels}`,
    };
  }

  if (sameSuit) {
    return {
      category: HandCategory.Color,
      values: ranks,
      cards,
      name: `Color, ${rankName(cards[0].rank)} high`,
    };
  }

  if (ranks[0] === ranks[1] || ranks[1] === ranks[2]) {
    const pairRank = ranks[1]; // the middle card is always part of the pair
    const kicker = ranks.find((r) => r !== pairRank) as number;
    const pairCards = cards.filter((c) => c.rank === pairRank);
    const kickerCard = cards.filter((c) => c.rank !== pairRank);
    return {
      category: HandCategory.Pair,
      values: [pairRank, kicker],
      cards: [...pairCards, ...kickerCard],
      name: `Pair of ${rankName(pairRank as Rank, true)}`,
    };
  }

  return {
    category: HandCategory.HighCard,
    values: ranks,
    cards,
    name: `${rankName(cards[0].rank)} high`,
  };
}

/** >0 if a beats b, <0 if b beats a, 0 for an exact tie. */
export function compareHands(a: HandEval, b: HandEval): number {
  if (a.category !== b.category) return a.category - b.category;
  const n = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < n; i++) {
    const diff = (a.values[i] ?? 0) - (b.values[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Indices of every hand that no other hand beats (more than one ⇒ a tie). */
export function findWinners(evals: readonly HandEval[]): number[] {
  if (evals.length === 0) return [];
  let best = evals[0];
  for (const e of evals) if (compareHands(e, best) > 0) best = e;
  return evals.flatMap((e, i) => (compareHands(e, best) === 0 ? [i] : []));
}

function describeTieBreak(winner: HandEval, other: HandEval): string {
  const { category } = winner;
  if (category === HandCategory.Trail) {
    return `${rankName(winner.values[0] as Rank, true)} beat ${rankName(other.values[0] as Rank, true)}`;
  }
  if (category === HandCategory.Pair) {
    if (winner.values[0] !== other.values[0]) {
      return `the higher pair (${rankName(winner.values[0] as Rank, true)} over ${rankName(other.values[0] as Rank, true)})`;
    }
    return `the higher kicker (${rankName(winner.values[1] as Rank)} over ${rankName(other.values[1] as Rank)})`;
  }
  if (category === HandCategory.Sequence || category === HandCategory.PureSequence) {
    return "the higher sequence";
  }
  for (let i = 0; i < winner.values.length; i++) {
    if (winner.values[i] !== other.values[i]) {
      const place = ["highest card", "second card", "third card"][i];
      return `a higher ${place} (${rankName(winner.values[i] as Rank)} over ${rankName(other.values[i] as Rank)})`;
    }
  }
  return "a higher hand";
}

/** One-line reason the winner won, measured against the best losing hand. */
export function explainWin(evals: readonly HandEval[], winners: readonly number[]): string {
  if (winners.length === evals.length) return "Every hand tied — the pot is shared.";
  const w = evals[winners[0]];
  const losers = evals.filter((_, i) => !winners.includes(i));
  const runnerUp = losers.reduce((best, e) => (compareHands(e, best) > 0 ? e : best), losers[0]);
  if (winners.length > 1) {
    return `${w.name} ties — identical value, so the win is shared.`;
  }
  if (w.category !== runnerUp.category) {
    return `${CATEGORY_SHORT[w.category]} outranks ${CATEGORY_SHORT[runnerUp.category]}, the next best hand.`;
  }
  return `Both held ${CATEGORY_SHORT[w.category]} — won on ${describeTieBreak(w, runnerUp)}.`;
}