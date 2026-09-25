// File: apps/api/src/modules/trading/__tests__/in-memory-settle.ts
//
// Faithful in-memory re-implementation of the locking + idempotency algorithm
// used by fin_agency_pay_host() in
// supabase/migrations/20260925000000_agency_trading_center.sql. Exists ONLY for
// unit-testing the algorithm (lock ordering, idempotency-before-mutation,
// balance verification, atomic all-or-nothing settlement) under real
// concurrency without a live Postgres. Production safety is enforced by
// Postgres (SELECT ... FOR UPDATE + UNIQUE(agency_id, idempotency_key)).

export class InsufficientBalanceError extends Error {
  constructor() {
    super("INSUFFICIENT_TRADING_BALANCE");
  }
}

interface TradingAccount {
  agencyId: string;
  balance: number;
}

interface HostAccount {
  hostId: string;
  coins: number;
}

/** Tiny per-agency mutex standing in for SELECT ... FOR UPDATE. */
class RowLockManager {
  private queues = new Map<string, Promise<unknown>>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.queues.set(key, gate);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class InMemoryTradingSettle {
  private agencies = new Map<string, TradingAccount>();
  private hosts = new Map<string, HostAccount>();
  private payments = new Map<string, string>(); // key: `${agencyId}:${idempotencyKey}` -> paymentId
  private locks = new RowLockManager();
  private paymentSeq = 0;

  createAgency(agencyId: string, balance: number): void {
    this.agencies.set(agencyId, { agencyId, balance });
  }

  createHost(hostId: string, coins: number): void {
    this.hosts.set(hostId, { hostId, coins });
  }

  getAgencyBalance(agencyId: string): number {
    return this.agencies.get(agencyId)?.balance ?? 0;
  }

  getHostCoins(hostId: string): number {
    return this.hosts.get(hostId)?.coins ?? 0;
  }

  paymentCount(agencyId: string): number {
    return [...this.payments.keys()].filter((k) => k.startsWith(`${agencyId}:`)).length;
  }

  async payHost(input: {
    agencyId: string;
    hostId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; newBalance: number; alreadyProcessed: boolean }> {
    const key = `${input.agencyId}:${input.idempotencyKey}`;

    return this.locks.withLock(input.agencyId, async () => {
      const existing = this.payments.get(key);
      if (existing) {
        return {
          paymentId: existing,
          newBalance: this.agencies.get(input.agencyId)!.balance,
          alreadyProcessed: true,
        };
      }

      const agency = this.agencies.get(input.agencyId);
      if (!agency) throw new Error("AGENCY_NOT_FOUND");

      if (agency.balance < input.amount) {
        throw new InsufficientBalanceError();
      }

      const host = this.hosts.get(input.hostId);
      if (!host) throw new Error("HOST_NOT_FOUND");

      agency.balance -= input.amount;
      host.coins += input.amount;

      this.paymentSeq += 1;
      const paymentId = `pay-${this.paymentSeq}`;
      this.payments.set(key, paymentId);

      return { paymentId, newBalance: agency.balance, alreadyProcessed: false };
    });
  }
}
