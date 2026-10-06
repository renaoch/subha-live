import { shuffleInPlace, type Rng } from "./rng";

export type Suit = "S" | "H" | "D" | "C";
/** 2-10, then J=11 Q=12 K=13 A=14. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };

export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

export function rankLabel(rank: Rank): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

const RANK_WORD: Record<number, string> = { 14: "Ace", 13: "King", 12: "Queen", 11: "Jack" };
export function rankName(rank: Rank, plural = false): string {
  const base = RANK_WORD[rank] ?? String(rank);
  return plural ? `${base}${rank === 6 ? "es" : "s"}` : base;
}

export function cardId(card: Card): string {
  return `${rankLabel(card.rank)}${card.suit}`;
}

export function cardName(card: Card): string {
  return `${rankName(card.rank)} of ${SUIT_NAME[card.suit]}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

export function shuffledDeck(rng: Rng): Card[] {
  return shuffleInPlace(createDeck(), rng);
}

/** Deals `cardsPerPlayer` cards to each player round-robin from the top. */
export function dealHands(deck: readonly Card[], players: number, cardsPerPlayer = 3): Card[][] {
  if (deck.length < players * cardsPerPlayer) throw new Error("Deck too small to deal");
  const hands: Card[][] = Array.from({ length: players }, () => []);
  let next = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < players; p++) hands[p].push(deck[next++]);
  }
  return hands;
}