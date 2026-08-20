import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  BdApplication,
  BdApplicationResult,
  BdOverview,
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