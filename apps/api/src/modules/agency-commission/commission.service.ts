// Agency commission versioning/settlement service. The effective rate for any
// historical gift is captured per-transaction in agency_commissions.rate_applied
// (by fin_send_gift), so changing the current rate never rewrites past earnings
// — a rate change only appends a version row + updates the live default.

import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";
import { assertAgencyOwner } from "../agency/agency.service";
import { assertIsPlatformAdmin } from "../financial/financial.service";
import { nextVersionNumber, validateRate, type CommissionState } from "./commission.logic";
import { commissionRepository as repo } from "./commission.repository";

/** Allow the agency owner OR a platform admin to change the rate. */
async function assertCanManage(actorId: string, agencyId: string): Promise<void> {
  try {
    await assertAgencyOwner(actorId, agencyId);
    return;
  } catch (ownerError) {
    // Fall through to the admin check only for the ownership failure.
    if ((ownerError as { code?: string }).code === "AGENCY_OWNER_REQUIRED") {
      await assertIsPlatformAdmin(actorId);
      return;
    }
    throw ownerError;
  }
}

export const commissionService = {
  async getState(actorId: string, agencyId: string): Promise<CommissionState> {
    await assertCanManage(actorId, agencyId);

    const [currentRate, versions, rollup] = await Promise.all([
      repo.getCurrentRate(agencyId),
      repo.listVersions(agencyId),
      repo.rollup(agencyId),
    ]);

    return {
      currentRate: currentRate ?? 0,
      pendingDiamonds: rollup.pendingDiamonds,
      settledDiamonds: rollup.settledDiamonds,
      totalCommissions: rollup.totalCommissions,
      versions,
    };
  },

  async setRate(actorId: string, agencyId: string, rate: number): Promise<CommissionState> {
    await assertCanManage(actorId, agencyId);

    const validated = validateRate(rate);
    if (!validated.ok) {
      throw new AppError(400, "Commission rate must be a whole number between 0 and 100", {
        code: "INVALID_COMMISSION_RATE",
      });
    }

    const versions = await repo.listVersions(agencyId);
    const nextVersion = nextVersionNumber(versions);

    await repo.recordVersion({
      agencyId,
      version: nextVersion,
      commissionRate: validated.rate,
      changedBy: actorId,
    });

    await logAudit({
      actorId,
      agencyId,
      action: "AGENCY_COMMISSION_RATE_CHANGED",
      entityType: "agency_commission_versions",
      newValue: { agencyId, version: nextVersion, commissionRate: validated.rate },
    });

    return this.getState(actorId, agencyId);
  },
};
