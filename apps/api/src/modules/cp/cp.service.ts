import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  CpPartnership,
  CpPartnershipResult,
  CpPartner,
  MyCpResult,
} from "./cp.types";

type CpPartnershipRow = Pick<
  CpPartnership,
  | "id"
  | "user_1"
  | "user_2"
  | "ring_name"
  | "cp_level"
  | "intimacy_points"
  | "status"
  | "anniversary_date"
  | "created_at"
>;

type ProfileRow = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  country_flag: string | null;
  level: number | null;
  is_verified: boolean | null;
};

function toCpPartner(
  profile: ProfileRow,
): CpPartner {
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    avatar: profile.avatar,
    country: profile.country,
    countryFlag:
      profile.country_flag,
    level: profile.level ?? 1,
    isVerified:
      profile.is_verified ?? false,
  };
}

async function getProfile(
  userId: string,
): Promise<ProfileRow> {
  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select(
      `
        id,
        name,
        handle,
        avatar,
        country,
        country_flag,
        level,
        is_verified
      `,
    )
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "User profile not found",
        {
          code:
            "PROFILE_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  return data as ProfileRow;
}

async function findActiveCpForUser(
  userId: string,
): Promise<CpPartnershipRow | null> {
  const {
    data,
    error,
  } = await supabase
    .from("cp_partnerships")
    .select(
      `
        id,
        user_1,
        user_2,
        ring_name,
        cp_level,
        intimacy_points,
        status,
        anniversary_date,
        created_at
      `,
    )
    .or(
      `user_1.eq.${userId},user_2.eq.${userId}`,
    )
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CpPartnershipRow | null;
}

async function toCpResult(
  partnership: CpPartnershipRow,
  currentUserId: string,
): Promise<CpPartnershipResult> {
  const partnerId =
    partnership.user_1 === currentUserId
      ? partnership.user_2
      : partnership.user_1;

  const partnerProfile =
    await getProfile(partnerId);

  return {
    id: partnership.id,

    ringName:
      partnership.ring_name,

    cpLevel:
      partnership.cp_level ?? 1,

    intimacyPoints:
      partnership.intimacy_points ?? 0,

    status:
      partnership.status,

    anniversaryDate:
      partnership.anniversary_date,

    createdAt:
      partnership.created_at,

    partner:
      toCpPartner(partnerProfile),
  };
}

/**
 * Get the authenticated user's
 * active CP partnership.
 */
export async function getMyCp(
  userId: string,
): Promise<MyCpResult> {
  const partnership =
    await findActiveCpForUser(
      userId,
    );

  if (!partnership) {
    return {
      partnership: null,
    };
  }

  return {
    partnership:
      await toCpResult(
        partnership,
        userId,
      ),
  };
}

/**
 * Get a CP partnership by ID.
 *
 * Only active partnerships are exposed
 * publicly.
 */
export async function getCpById(
  partnershipId: string,
): Promise<CpPartnershipResult> {
  const {
    data,
    error,
  } = await supabase
    .from("cp_partnerships")
    .select(
      `
        id,
        user_1,
        user_2,
        ring_name,
        cp_level,
        intimacy_points,
        status,
        anniversary_date,
        created_at
      `,
    )
    .eq("id", partnershipId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(
      404,
      "CP partnership not found",
      {
        code:
          "CP_PARTNERSHIP_NOT_FOUND",
      },
    );
  }

  const partnership =
    data as CpPartnershipRow;

  const partnerProfile =
    await getProfile(
      partnership.user_2,
    );

  return {
    id: partnership.id,

    ringName:
      partnership.ring_name,

    cpLevel:
      partnership.cp_level ?? 1,

    intimacyPoints:
      partnership.intimacy_points ?? 0,

    status:
      partnership.status,

    anniversaryDate:
      partnership.anniversary_date,

    createdAt:
      partnership.created_at,

    partner:
      toCpPartner(
        partnerProfile,
      ),
  };
}

/**
 * Create a CP partnership.
 *
 * Since the current schema has no request/invitation
 * table, this creates the relationship directly.
 */
export async function createCp(
  userId: string,
  partnerId: string,
  ringName: string | null,
): Promise<CpPartnershipResult> {
  if (userId === partnerId) {
    throw new AppError(
      400,
      "You cannot create a CP partnership with yourself",
      {
        code:
          "CP_SELF_PARTNERSHIP",
      },
    );
  }

  await getProfile(partnerId);

  const existingCp =
    await findActiveCpForUser(
      userId,
    );

  if (existingCp) {
    throw new AppError(
      409,
      "You already have an active CP partnership",
      {
        code:
          "CP_ALREADY_EXISTS",
      },
    );
  }

  const partnerExistingCp =
    await findActiveCpForUser(
      partnerId,
    );

  if (partnerExistingCp) {
    throw new AppError(
      409,
      "This user already has an active CP partnership",
      {
        code:
          "PARTNER_ALREADY_HAS_CP",
      },
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("cp_partnerships")
    .insert({
      id: crypto.randomUUID(),
      user_1: userId,
      user_2: partnerId,
      ring_name: ringName,
      cp_level: 1,
      intimacy_points: 0,
      status: "active",
      anniversary_date:
        new Date().toISOString(),
    })
    .select(
      `
        id,
        user_1,
        user_2,
        ring_name,
        cp_level,
        intimacy_points,
        status,
        anniversary_date,
        created_at
      `,
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "A CP partnership already exists for one of these users",
        {
          code:
            "CP_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  return toCpResult(
    data as CpPartnershipRow,
    userId,
  );
}

/**
 * End the authenticated user's
 * active CP partnership.
 */
export async function endCp(
  userId: string,
  partnershipId: string,
): Promise<void> {
  const {
    data,
    error,
  } = await supabase
    .from("cp_partnerships")
    .select(
      `
        id,
        user_1,
        user_2,
        ring_name,
        cp_level,
        intimacy_points,
        status,
        anniversary_date,
        created_at
      `,
    )
    .eq("id", partnershipId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(
      404,
      "CP partnership not found",
      {
        code:
          "CP_PARTNERSHIP_NOT_FOUND",
      },
    );
  }

  const partnership =
    data as CpPartnershipRow;

  const isParticipant =
    partnership.user_1 === userId ||
    partnership.user_2 === userId;

  if (!isParticipant) {
    throw new AppError(
      403,
      "You are not a member of this CP partnership",
      {
        code:
          "CP_FORBIDDEN",
      },
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("cp_partnerships")
    .update({
      status: "ended",
    })
    .eq("id", partnershipId)
    .eq("status", "active");

  if (updateError) {
    throw updateError;
  }
}