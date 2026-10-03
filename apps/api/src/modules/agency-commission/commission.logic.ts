// Agency commission pure logic — rate validation + version number computation.
// Testable without a DB.

export interface CommissionVersion {
  id: string;
  version: number;
  commissionRate: number;
  changedBy: string | null;
  createdAt: string;
}

export interface CommissionState {
  currentRate: number;
  pendingDiamonds: number;
  settledDiamonds: number;
  totalCommissions: number;
  versions: CommissionVersion[];
}

export type RateValidation =
  | { ok: true; rate: number }
  | { ok: false; reason: "invalid" | "out_of_range" };

/** Commission rate is an integer percentage in [0, 100]. */
export function validateRate(value: unknown): RateValidation {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, reason: "invalid" };
  }
  if (value < 0 || value > 100) {
    return { ok: false, reason: "out_of_range" };
  }
  return { ok: true, rate: value };
}

/** The next version number after the highest existing version. */
export function nextVersionNumber(existing: Array<{ version: number }>): number {
  const max = existing.reduce((m, v) => Math.max(m, v.version), 0);
  return max + 1;
}
