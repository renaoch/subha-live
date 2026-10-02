// File: apps/api/src/modules/rewards/__tests__/in-memory-settle.ts
//
// Faithful in-memory re-implementation of the locking + idempotency algorithm
// used by fin_claim_daily_reward(). Exists ONLY for unit-testing the algorithm
// (lock ordering, idempotency-before-mutation, streak advance, atomic all-or-
// nothing grant) under real concurrency without a live Postgres. Production
// safety is enforced by Postgres (SELECT ... FOR UPDATE + UNIQUE(user_id,
// reward_date)).

interface Account {
  id: string;
  coins: number;
}

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string | null;
}

/** Tiny per-user mutex standing in for SELECT ... FOR UPDATE on the streak row. */
class RowLockManager {
  private queues = new Map<string, Promise<unknown>>();

  async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.queues.set(id, gate);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class InMemoryDailyRewardSettle {
  private accounts = new Map<string, Account>();
  private streaks = new Map<string, StreakState>();
  private claims = new Set<string>(); // key: `${userId}:${rewardDate}`
  private locks = new RowLockManager();

  createAccount(id: string, coins: number): void {
    this.accounts.set(id, { id, coins });
  }

  getCoins(id: string): number {
    return this.accounts.get(id)?.coins ?? 0;
  }

  getStreak(id: string): StreakState {
    return this.streaks.get(id) ?? { currentStreak: 0, longestStreak: 0, lastClaimDate: null };
  }

  claimCount(id: string): number {
    return [...this.claims].filter((k) => k.startsWith(`${id}:`)).length;
  }

  async claim(input: {
    userId: string;
    rewardDate: string;
    rewardCoins: number;
  }): Promise<{ newCoins: number; newStreak: number; alreadyProcessed: boolean }> {
    return this.locks.withLock(input.userId, async () => {
      const streak = this.streaks.get(input.userId) ?? {
        currentStreak: 0,
        longestStreak: 0,
        lastClaimDate: null,
      };

      if (streak.lastClaimDate === input.rewardDate) {
        return {
          newCoins: this.getCoins(input.userId),
          newStreak: streak.currentStreak,
          alreadyProcessed: true,
        };
      }

      const yesterday = previousDay(input.rewardDate);
      const newStreak = streak.lastClaimDate === yesterday ? streak.currentStreak + 1 : 1;
      const account = this.accounts.get(input.userId);
      if (!account) throw new Error("USER_NOT_FOUND");

      account.coins += input.rewardCoins;
      streak.currentStreak = newStreak;
      streak.longestStreak = Math.max(streak.longestStreak, newStreak);
      streak.lastClaimDate = input.rewardDate;
      this.streaks.set(input.userId, streak);
      this.claims.add(`${input.userId}:${input.rewardDate}`);

      return { newCoins: account.coins, newStreak, alreadyProcessed: false };
    });
  }
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
