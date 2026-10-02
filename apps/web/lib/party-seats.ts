// Seat-unlock rules for audio party rooms.
//
// A party starts with INITIAL_SEATS open seats. Every time the room collects
// another COINS_PER_UNLOCK coins (10 lakh), the next SEATS_PER_UNLOCK seats open:
//
//   0 coins  -> seats 1-4
//   10 lakh  -> seats 1-7   (5-7 unlock)
//   20 lakh  -> seats 1-10  (8-10 unlock)  ...and so on, up to the room's seat count.

export const INITIAL_SEATS = 4;
export const SEATS_PER_UNLOCK = 3;
export const COINS_PER_UNLOCK = 1_000_000; // 10 lakh

/** How many seats (1-based count) are open for a given room coin total. */
export function unlockedSeatCount(roomCoins: number, totalSeats: number): number {
  const tiers = Math.floor(Math.max(0, roomCoins) / COINS_PER_UNLOCK);
  return Math.min(totalSeats, INITIAL_SEATS + tiers * SEATS_PER_UNLOCK);
}

/** Coins the room needs for the 0-based seat `index` to open. */
export function coinsToUnlockSeat(index: number): number {
  if (index < INITIAL_SEATS) return 0;
  return (Math.floor((index - INITIAL_SEATS) / SEATS_PER_UNLOCK) + 1) * COINS_PER_UNLOCK;
}

/** Seat indices grouped by unlock tier: [[0..3],[4..6],[7..9]]. */
export function seatTiers(totalSeats: number): number[][] {
  const tiers: number[][] = [];
  let i = 0;
  let size = INITIAL_SEATS;
  while (i < totalSeats) {
    tiers.push(Array.from({ length: Math.min(size, totalSeats - i) }, (_, k) => i + k));
    i += size;
    size = SEATS_PER_UNLOCK;
  }
  return tiers;
}

/** 1,000,000 -> "10L", 12,50,000 -> "12.5L", 1 crore -> "1Cr". */
export function formatLakh(n: number): string {
  if (n >= 10_000_000) return `${trim(n / 10_000_000)}Cr`;
  if (n >= 100_000) return `${trim(n / 100_000)}L`;
  if (n >= 1_000) return `${trim(n / 1_000)}K`;
  return `${Math.floor(n)}`;
}

function trim(v: number): string {
  return v.toFixed(1).replace(/\.0$/, "");
}