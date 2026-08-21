// File: apps/api/src/lib/audit.ts

import { supabase } from "./supabase";

interface AuditEntry {
  actorId: string;
  agencyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Writes an audit log row. Deliberately swallows its own errors — an audit
 * log failure should never roll back or fail the business operation that
 * triggered it, it should just get logged to stderr for someone to notice.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await (supabase.from("audit_logs" as any) as any).insert({
      actor_id: entry.actorId,
      agency_id: entry.agencyId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
    });

    if (error) {
      console.error("AUDIT LOG WRITE ERROR:", error);
    }
  } catch (error) {
    console.error("AUDIT LOG WRITE ERROR:", error);
  }
}