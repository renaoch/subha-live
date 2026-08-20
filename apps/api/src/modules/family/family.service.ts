import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  Family,
  FamilyMember,
  FamilyMemberResult,
  FamilyResult,
  MyFamilyResult,
} from "./family.types";

type FamilyRow = Pick<
  Family,
  | "id"
  | "name"
  | "badge_text"
  | "logo_url"
  | "leader_id"
  | "level"
  | "exp"
  | "announcement"
  | "max_members"
  | "created_at"
>;

type FamilyMemberRow = Pick<
  FamilyMember,
  | "family_id"
  | "user_id"
  | "role"
  | "joined_at"
>;

type FamilyWithMemberRow =
  FamilyMemberRow & {
    profiles:
      | {
          id: string;
          name: string;
          handle: string;
          avatar: string | null;
        }
      | null;
  };

function toFamilyMember(
  row: FamilyWithMemberRow,
): FamilyMemberResult {
  if (!row.profiles) {
    throw new AppError(
      500,
      "Family member profile is missing",
      {
        code:
          "FAMILY_MEMBER_PROFILE_MISSING",
      },
    );
  }

  return {
    userId: row.user_id,
    name: row.profiles.name,
    handle: row.profiles.handle,
    avatar: row.profiles.avatar,
    role: row.role ?? "member",
    joinedAt: row.joined_at,
  };
}

async function getFamilyMembers(
  familyId: string,
): Promise<FamilyMemberResult[]> {
  const {
    data,
    error,
  } = await supabase
    .from("family_members")
    .select(
      `
        family_id,
        user_id,
        role,
        joined_at,
        profiles (
          id,
          name,
          handle,
          avatar
        )
      `,
    )
    .eq("family_id", familyId)
    .order("joined_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const rows =
    (data ?? []) as FamilyWithMemberRow[];

  return rows.map(
    (row: FamilyWithMemberRow) =>
      toFamilyMember(row),
  );
}

async function getFamilyById(
  familyId: string,
): Promise<FamilyResult> {
  const {
    data,
    error,
  } = await supabase
    .from("families")
    .select(
      `
        id,
        name,
        badge_text,
        logo_url,
        leader_id,
        level,
        exp,
        announcement,
        max_members,
        created_at
      `,
    )
    .eq("id", familyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "Family not found",
        {
          code:
            "FAMILY_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  const family =
    data as FamilyRow;

  const members =
    await getFamilyMembers(
      family.id,
    );

  return {
    id: family.id,
    name: family.name,
    badgeText: family.badge_text,
    logoUrl: family.logo_url,
    leaderId: family.leader_id,
    level: family.level ?? 1,
    exp: family.exp ?? 0,
    announcement:
      family.announcement,
    maxMembers:
      family.max_members ?? 50,
    createdAt:
      family.created_at,
    memberCount:
      members.length,
    members,
  };
}

/**
 * Get all families the authenticated user
 * currently belongs to.
 *
 * The schema allows multiple family memberships,
 * so this returns an array rather than pretending
 * there can only ever be one.
 */
export async function getMyFamilies(
  userId: string,
): Promise<MyFamilyResult> {
  const {
    data,
    error,
  } = await supabase
    .from("family_members")
    .select(
      "family_id, user_id, role, joined_at",
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const memberships =
    (data ?? []) as FamilyMemberRow[];

  const families: FamilyResult[] =
    [];

  for (
    const membership of memberships
  ) {
    const family =
      await getFamilyById(
        membership.family_id,
      );

    families.push(family);
  }

  return {
    families,
  };
}

/**
 * Get a public family.
 */
export async function getPublicFamily(
  familyId: string,
): Promise<FamilyResult> {
  return getFamilyById(
    familyId,
  );
}

/**
 * Create a family and make the
 * authenticated user its leader.
 */
export async function createFamily(
  userId: string,
  input: {
    id: string;
    name: string;
    badge_text: string;
    logo_url?: string | null;
    announcement?: string | null;
    max_members?: number;
  },
): Promise<FamilyResult> {
  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("families")
    .select("id")
    .eq("id", input.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new AppError(
      409,
      "Family ID is already in use",
      {
        code:
          "FAMILY_ID_ALREADY_EXISTS",
      },
    );
  }

  const {
    data: family,
    error: familyError,
  } = await supabase
    .from("families")
    .insert({
      id: input.id,
      name: input.name,
      badge_text:
        input.badge_text,
      logo_url:
        input.logo_url ?? null,
      leader_id: userId,
      level: 1,
      exp: 0,
      announcement:
        input.announcement ?? null,
      max_members:
        input.max_members ?? 50,
    })
    .select(
      `
        id,
        name,
        badge_text,
        logo_url,
        leader_id,
        level,
        exp,
        announcement,
        max_members,
        created_at
      `,
    )
    .single();

  if (familyError) {
    if (
      familyError.code === "23505"
    ) {
      throw new AppError(
        409,
        "Family ID is already in use",
        {
          code:
            "FAMILY_ID_ALREADY_EXISTS",
        },
      );
    }

    throw familyError;
  }

  const {
    error: memberError,
  } = await supabase
    .from("family_members")
    .insert({
      family_id: input.id,
      user_id: userId,
      role: "leader",
    });

  if (memberError) {
    /*
     * The family was created but its leader
     * membership failed. Do our best to roll
     * the family creation back.
     */
    await supabase
      .from("families")
      .delete()
      .eq("id", input.id)
      .eq("leader_id", userId);

    throw memberError;
  }

  return getFamilyById(
    family.id,
  );
}

/**
 * Join a family.
 */
export async function joinFamily(
  userId: string,
  familyId: string,
): Promise<FamilyResult> {
  const {
    data: family,
    error: familyError,
  } = await supabase
    .from("families")
    .select(
      `
        id,
        name,
        badge_text,
        logo_url,
        leader_id,
        level,
        exp,
        announcement,
        max_members,
        created_at
      `,
    )
    .eq("id", familyId)
    .single();

  if (familyError) {
    if (
      familyError.code ===
      "PGRST116"
    ) {
      throw new AppError(
        404,
        "Family not found",
        {
          code:
            "FAMILY_NOT_FOUND",
        },
      );
    }

    throw familyError;
  }

  const {
    data: existingMembership,
    error:
      membershipCheckError,
  } = await supabase
    .from("family_members")
    .select(
      "family_id, user_id, role, joined_at",
    )
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipCheckError) {
    throw membershipCheckError;
  }

  if (existingMembership) {
    throw new AppError(
      409,
      "You are already a member of this family",
      {
        code:
          "ALREADY_FAMILY_MEMBER",
      },
    );
  }

  const {
    count,
    error: countError,
  } = await supabase
    .from("family_members")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("family_id", familyId);

  if (countError) {
    throw countError;
  }

  const maxMembers =
    family.max_members ?? 50;

  if (
    (count ?? 0) >= maxMembers
  ) {
    throw new AppError(
      409,
      "Family has reached its member limit",
      {
        code:
          "FAMILY_MEMBER_LIMIT_REACHED",
      },
    );
  }

  const {
    error: insertError,
  } = await supabase
    .from("family_members")
    .insert({
      family_id: familyId,
      user_id: userId,
      role: "member",
    });

  if (insertError) {
    if (
      insertError.code ===
      "23505"
    ) {
      throw new AppError(
        409,
        "You are already a member of this family",
        {
          code:
            "ALREADY_FAMILY_MEMBER",
        },
      );
    }

    throw insertError;
  }

  return getFamilyById(
    familyId,
  );
}

/**
 * Leave a family.
 *
 * Leaders cannot leave their family
 * until leadership is transferred.
 */
export async function leaveFamily(
  userId: string,
  familyId: string,
): Promise<void> {
  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("family_members")
    .select(
      "family_id, user_id, role, joined_at",
    )
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new AppError(
      404,
      "You are not a member of this family",
      {
        code:
          "FAMILY_MEMBERSHIP_NOT_FOUND",
      },
    );
  }

  if (
    membership.role ===
    "leader"
  ) {
    throw new AppError(
      400,
      "Family leaders cannot leave their family",
      {
        code:
          "FAMILY_LEADER_CANNOT_LEAVE",
      },
    );
  }

  const {
    error: deleteError,
  } = await supabase
    .from("family_members")
    .delete()
    .eq("family_id", familyId)
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }
}