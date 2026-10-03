// Durable access for agency commission versioning/settlement.
// agency_commission_versions post-dates the generated types (untyped view);
// agencies/agency_commissions are in the generated schema.

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import type { CommissionVersion } from "./commission.logic";

const db = supabase as unknown as { from: (table: string) => any };

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export const commissionRepository = {
  async getCurrentRate(agencyId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from("agencies")
      .select("commission_rate")
      .eq("id", agencyId)
      .maybeSingle();
    if (error) return null;
    return data ? toNumber(data.commission_rate) : null;
  },

  async listVersions(agencyId: string): Promise<CommissionVersion[]> {
    const { data, error } = await db
      .from("agency_commission_versions")
      .select("id, version, commission_rate, changed_by, created_at")
      .eq("agency_id", agencyId)
      .order("version", { ascending: false });

    if (error) {
      throw new AppError(500, "Failed to load commission versions", {
        code: "COMMISSION_VERSIONS_FAILED",
        details: error.message,
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      version: toNumber(row.version),
      commissionRate: toNumber(row.commission_rate),
      changedBy: (row.changed_by as string | null) ?? null,
      createdAt: String(row.created_at),
    }));
  },

  async rollup(agencyId: string): Promise<{ pendingDiamonds: number; settledDiamonds: number; totalCommissions: number }> {
    const { data, error } = await db
      .from("agency_commissions")
      .select("commission_diamonds, payout_id")
      .eq("agency_id", agencyId);

    if (error) {
      throw new AppError(500, "Failed to load commission rollup", {
        code: "COMMISSION_ROLLUP_FAILED",
        details: error.message,
      });
    }

    const rows = (data ?? []) as Array<{ commission_diamonds: number; payout_id: string | null }>;
    let pendingDiamonds = 0;
    let settledDiamonds = 0;
    for (const row of rows) {
      const d = toNumber(row.commission_diamonds);
      if (row.payout_id) settledDiamonds += d;
      else pendingDiamonds += d;
    }
    return { pendingDiamonds, settledDiamonds, totalCommissions: rows.length };
  },

  /** Insert a version + update the agency's current rate. */
  async recordVersion(input: {
    agencyId: string;
    version: number;
    commissionRate: number;
    changedBy: string;
  }): Promise<void> {
    const { error: insertError } = await db
      .from("agency_commission_versions")
      .insert({
        agency_id: input.agencyId,
        version: input.version,
        commission_rate: input.commissionRate,
        changed_by: input.changedBy,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        throw new AppError(409, "A version with this number already exists", {
          code: "COMMISSION_VERSION_CONFLICT",
        });
      }
      throw new AppError(500, "Failed to record commission version", {
        code: "COMMISSION_VERSION_FAILED",
        details: insertError.message,
      });
    }

    const { error: updateError } = await supabase
      .from("agencies")
      .update({ commission_rate: input.commissionRate })
      .eq("id", input.agencyId);

    if (updateError) {
      throw new AppError(500, "Failed to update commission rate", {
        code: "COMMISSION_RATE_UPDATE_FAILED",
        details: updateError.message,
      });
    }
  },
};
