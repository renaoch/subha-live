import { randomUUID } from "crypto";

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";

import type {
  BdApplication,
  BdApplicationResult,
  BdOverview,
  BdApplicationAdminResult,
  ApproveBdApplicationResult,
} from "./bd.types";

import type {
  CreateBdApplicationInput,
} from "./bd.schema";

type BdApplicationRow = Pick<
  BdApplication,
  | "id"
  | "full_name"
  | "contact_number"
  | "agency_experience"
  | "monthly_target_usd"
  | "status"
  | "created_at"
>;

function toBdApplication(
  row: BdApplicationRow,
): BdApplicationResult {
  return {
    id: row.id,
    fullName: row.full_name,
    contactNumber:
      row.contact_number,
    agencyExperience:
      row.agency_experience,
    monthlyTargetUsd:
      row.monthly_target_usd,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Get the authenticated user's
 * current BD application.
 */
export async function getMyBd(
  userId: string,
): Promise<BdOverview> {
  const {
    data,
    error,
  } = await supabase
    .from("bd_applications")
    .select(
      `
        id,
        full_name,
        contact_number,
        agency_experience,
        monthly_target_usd,
        status,
        created_at
      `,
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    application: data
      ? toBdApplication(
          data as BdApplicationRow,
        )
      : null,
  };
}

/**
 * Submit a BD application.
 */
export async function createBdApplication(
  userId: string,
  input: CreateBdApplicationInput,
): Promise<BdApplicationResult> {
  /*
   * Check whether the user already has
   * a pending or approved application.
   */
  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("bd_applications")
    .select(
      `
        id,
        full_name,
        contact_number,
        agency_experience,
        monthly_target_usd,
        status,
        created_at
      `,
    )
    .eq("user_id", userId)
    .in("status", [
      "pending",
      "approved",
    ])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new AppError(
      409,
      "You already have an active BD application",
      {
        code:
          "BD_APPLICATION_ALREADY_EXISTS",
      },
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("bd_applications")
    .insert({
      user_id: userId,
      full_name: input.fullName,
      contact_number:
        input.contactNumber,
      agency_experience:
        input.agencyExperience ?? null,
      monthly_target_usd:
        input.monthlyTargetUsd ?? null,
      status: "pending",
    })
    .select(
      `
        id,
        full_name,
        contact_number,
        agency_experience,
        monthly_target_usd,
        status,
        created_at
      `,
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "A BD application already exists",
        {
          code:
            "BD_APPLICATION_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  return toBdApplication(
    data as BdApplicationRow,
  );
}

/* ========================================================================== */
/* ADMIN                                                                      */
/* ========================================================================== */

async function assertAdmin(
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.is_admin) {
    throw new AppError(
      403,
      "Admin permission required",
      {
        code: "ADMIN_REQUIRED",
      },
    );
  }
}

/**
 * Admin: list every agency-owner application, newest first, with the
 * applicant's public profile info attached so the admin panel can show
 * who applied.
 */
export async function listBdApplications(
  adminUserId: string,
): Promise<BdApplicationAdminResult[]> {
  await assertAdmin(adminUserId);

  const { data, error } = await (
    supabase.from("bd_applications" as any) as any
  )
    .select(
      `
        id,
        user_id,
        full_name,
        contact_number,
        agency_experience,
        monthly_target_usd,
        status,
        created_at,
        profiles (
          id,
          name,
          handle,
          avatar,
          public_id
        )
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    contactNumber: row.contact_number,
    agencyExperience: row.agency_experience,
    monthlyTargetUsd: row.monthly_target_usd,
    status: row.status,
    createdAt: row.created_at,
    applicant: row.profiles
      ? {
          id: row.profiles.id,
          name: row.profiles.name,
          handle: row.profiles.handle,
          avatar: row.profiles.avatar,
          publicId: row.profiles.public_id,
        }
      : null,
  }));
}

function generateAgencyCode(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 8; i++) {
    code +=
      alphabet[
        Math.floor(Math.random() * alphabet.length)
      ];
  }

  return code;
}

/**
 * Admin: approve a pending agency-owner application.
 *
 * This:
 *  1. marks the bd_application as "approved"
 *  2. creates a brand new agency owned by the applicant
 *  3. promotes the applicant's profiles.role to "agency_owner"
 *     (drives the "Agency Owner" profile badge)
 */
export async function approveBdApplication(
  adminUserId: string,
  applicationId: string,
): Promise<ApproveBdApplicationResult> {
  await assertAdmin(adminUserId);

  const { data: application, error: fetchError } =
    await supabase
      .from("bd_applications")
      .select(
        "id, user_id, full_name, contact_number, agency_experience, monthly_target_usd, status, created_at",
      )
      .eq("id", applicationId)
      .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!application) {
    throw new AppError(
      404,
      "Application not found",
      {
        code: "BD_APPLICATION_NOT_FOUND",
      },
    );
  }

  if (application.status === "approved") {
    throw new AppError(
      409,
      "This application has already been approved",
      {
        code: "BD_APPLICATION_ALREADY_APPROVED",
      },
    );
  }

  // Create the agency for the applicant. Agency codes must be unique, so
  // retry a handful of times on the (very unlikely) chance of a collision.
  let createdAgency:
    | { id: string; name: string; code: string; owner_id: string }
    | null = null;

  let lastInsertError: unknown = null;

  for (let attempt = 0; attempt < 5 && !createdAgency; attempt++) {
    const agencyId = randomUUID();
    const code = generateAgencyCode();

    const { data: agencyRow, error: insertError } = await (
      supabase.from("agencies" as any) as any
    )
      .insert({
        id: agencyId,
        name: `${application.full_name}'s Agency`,
        owner_id: application.user_id,
        code,
        is_active: true,
      })
      .select("id, name, code, owner_id")
      .single();

    if (!insertError) {
      createdAgency = agencyRow;
      break;
    }

    lastInsertError = insertError;

    // 23505 = unique_violation (agency code collision) -> retry.
    if (insertError.code !== "23505") {
      throw insertError;
    }
  }

  if (!createdAgency) {
    throw (
      lastInsertError ??
      new AppError(500, "Failed to create agency", {
        code: "AGENCY_CREATION_FAILED",
      })
    );
  }

  const { data: updatedApplication, error: updateError } =
    await supabase
      .from("bd_applications")
      .update({ status: "approved" })
      .eq("id", applicationId)
      .select(
        "id, full_name, contact_number, agency_experience, monthly_target_usd, status, created_at",
      )
      .single();

  if (updateError) {
    throw updateError;
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "agency_owner" as any })
    .eq("id", application.user_id);

  if (roleError) {
    console.error(
      "Failed to promote applicant to agency_owner:",
      roleError,
    );
  }

  await logAudit({
    actorId: adminUserId,
    agencyId: createdAgency.id,
    action: "BD_APPLICATION_APPROVED",
    entityType: "bd_applications",
    entityId: applicationId,
    newValue: {
      agencyId: createdAgency.id,
      ownerId: application.user_id,
    },
  });

  return {
    application: toBdApplication(
      updatedApplication as BdApplicationRow,
    ),
    agency: {
      id: createdAgency.id,
      name: createdAgency.name,
      code: createdAgency.code,
      ownerId: createdAgency.owner_id,
    },
  };
}

/**
 * Admin: reject a pending agency-owner application.
 */
export async function rejectBdApplication(
  adminUserId: string,
  applicationId: string,
): Promise<BdApplicationResult> {
  await assertAdmin(adminUserId);

  const { data: existing, error: fetchError } = await supabase
    .from("bd_applications")
    .select("id, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existing) {
    throw new AppError(
      404,
      "Application not found",
      {
        code: "BD_APPLICATION_NOT_FOUND",
      },
    );
  }

  const { data, error } = await supabase
    .from("bd_applications")
    .update({ status: "rejected" })
    .eq("id", applicationId)
    .select(
      "id, full_name, contact_number, agency_experience, monthly_target_usd, status, created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: adminUserId,
    action: "BD_APPLICATION_REJECTED",
    entityType: "bd_applications",
    entityId: applicationId,
  });

  return toBdApplication(data as BdApplicationRow);
}