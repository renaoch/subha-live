// Pure PK state-machine transition rules. No I/O — unit-tested directly.

import type { PkStatus } from "./pk.types";

const TRANSITIONS: Record<PkStatus, PkStatus[]> = {
  IDLE: ["INVITED"],
  INVITED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["STARTING", "CANCELLED"],
  STARTING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["FINALIZING", "CANCELLED"],
  FINALIZING: ["FINISHED"],
  FINISHED: [],
  CANCELLED: [],
};

/** True if `from -> to` is a legal transition. Terminal states admit nothing. */
export function canTransition(from: PkStatus, to: PkStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Throw if the transition is illegal. Returns the target on success. */
export function assertTransition(from: PkStatus, to: PkStatus): PkStatus {
  if (!canTransition(from, to)) {
    throw new PkStateError(from, to);
  }
  return to;
}

export class PkStateError extends Error {
  constructor(public readonly from: PkStatus, public readonly to: PkStatus) {
    super(`Invalid PK transition: ${from} -> ${to}`);
    this.name = "PkStateError";
  }
}

/** Whether a status still accepts score contributions. */
export function isScoreable(status: PkStatus): boolean {
  return status === "ACTIVE";
}

/** Whether a status is terminal. */
export function isTerminal(status: PkStatus): boolean {
  return status === "FINISHED" || status === "CANCELLED";
}
