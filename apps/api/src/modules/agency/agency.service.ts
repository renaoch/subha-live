import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  Agency,
  AgencyHost,
  AgencySummary,
  AgencyMember,
  MyAgencyResult,
  AgencyDetailsResult,
  AgencyApplicationResult,
  AgencyListResult,
} from "./agency.types";

type AgencyRow = Pick<
  Agency,
  | "id"
  | "code"
  | "name"
  | "owner_id"
  | "commission_rate"
  | "monthly_revenue"
  | "total_hosts"
  | "created_at"
>;

type AgencyHostRow = Pick<
  AgencyHost,
  | "agency_id"
  | "host_id"
  | "status"
  | "joined_at"
>;

type AgencyProfileRow = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  country: string | null;
  country_flag: string | null;
  level: number | null;
};

type AgencyOwnerRow = {
  id: string;
  owner_id: string;
};

function toAgencySummary(
  agency: AgencyRow,
): AgencySummary {
  return {
    id: agency.id,
    code: agency.code,
    name: agency.name,
    ownerId: agency.owner_id,
    commissionRate: agency.commission_rate ?? 0,
    monthlyRevenue: agency.monthly_revenue ?? 0,
    totalHosts: agency.total_hosts ?? 0,
    createdAt: agency.created_at,
  };
}

export async function getAgencies(): Promise<AgencyListResult> {
  const {
    data,
    error,
  } = await supabase
    .from("agencies")
    .select(
      `
        id,
        code,
        name,
        owner_id,
        commission_rate,
        monthly_revenue,
        total_hosts,
        created_at
      `,
    );

  if (error) {
    throw error;
  }

  const rows: AgencyRow[] =
    (data ?? []) as AgencyRow[];

  return {
    agencies: rows.map(
      (agency: AgencyRow) =>
        toAgencySummary(agency),
    ),
  };
}

export async function getMyAgency(
  userId: string,
): Promise<MyAgencyResult> {
  const {
    data,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("host_id", userId)
    .in("status", [
      "pending",
      "approved",
    ])
    .order("joined_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const membership =
    data as AgencyHostRow | null;

  if (!membership) {
    return {
      agency: null,
      membershipStatus: null,
    };
  }

  const {
    data: agencyData,
    error: agencyError,
  } = await supabase
    .from("agencies")
    .select(
      `
        id,
        code,
        name,
        owner_id,
        commission_rate,
        monthly_revenue,
        total_hosts,
        created_at
      `,
    )
    .eq("id", membership.agency_id)
    .single();

  if (agencyError) {
    if (agencyError.code === "PGRST116") {
      throw new AppError(
        404,
        "Agency not found",
        {
          code: "AGENCY_NOT_FOUND",
        },
      );
    }

    throw agencyError;
  }

  const agency =
    agencyData as AgencyRow;

  return {
    agency: toAgencySummary(agency),
    membershipStatus:
      membership.status,
  };
}

export async function getAgencyById(
  agencyId: string,
): Promise<AgencyDetailsResult> {
  const {
    data: agencyData,
    error: agencyError,
  } = await supabase
    .from("agencies")
    .select(
      `
        id,
        code,
        name,
        owner_id,
        commission_rate,
        monthly_revenue,
        total_hosts,
        created_at
      `,
    )
    .eq("id", agencyId)
    .single();

  if (agencyError) {
    if (agencyError.code === "PGRST116") {
      throw new AppError(
        404,
        "Agency not found",
        {
          code: "AGENCY_NOT_FOUND",
        },
      );
    }

    throw agencyError;
  }

  const agency =
    agencyData as AgencyRow;

  const {
    data: memberData,
    error: membersError,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("agency_id", agencyId)
    .eq("status", "approved")
    .order("joined_at", {
      ascending: true,
    });

  if (membersError) {
    throw membersError;
  }

  const memberships: AgencyHostRow[] =
    (memberData ?? []) as AgencyHostRow[];

  const hostIds = memberships.map(
    (member: AgencyHostRow) =>
      member.host_id,
  );

  let profiles: AgencyProfileRow[] = [];

  if (hostIds.length > 0) {
    const {
      data: profileData,
      error: profilesError,
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
          level
        `,
      )
      .in("id", hostIds);

    if (profilesError) {
      throw profilesError;
    }

    profiles =
      (profileData ?? []) as AgencyProfileRow[];
  }

  const profileMap =
    new Map<string, AgencyProfileRow>(
      profiles.map(
        (
          profile: AgencyProfileRow,
        ) => [
          profile.id,
          profile,
        ],
      ),
    );

  const resultMembers: AgencyMember[] =
    memberships
      .map(
        (
          member: AgencyHostRow,
        ): AgencyMember | null => {
          const profile =
            profileMap.get(
              member.host_id,
            );

          if (!profile) {
            return null;
          }

          return {
            userId: profile.id,
            name: profile.name,
            handle: profile.handle,
            avatar: profile.avatar,
            country: profile.country,
            countryFlag:
              profile.country_flag,
            level: profile.level ?? 1,
            status: member.status,
            joinedAt: member.joined_at,
          };
        },
      )
      .filter(
        (
          member: AgencyMember | null,
        ): member is AgencyMember =>
          member !== null,
      );

  return {
    agency: toAgencySummary(agency),
    members: resultMembers,
  };
}

export async function requestAgencyJoin(
  userId: string,
  agencyId: string,
): Promise<AgencyApplicationResult> {
  const {
    data: agencyData,
    error: agencyError,
  } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .maybeSingle();

  if (agencyError) {
    throw agencyError;
  }

  if (!agencyData) {
    throw new AppError(
      404,
      "Agency not found",
      {
        code: "AGENCY_NOT_FOUND",
      },
    );
  }

  const {
    data: existingData,
    error: existingError,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("host_id", userId)
    .in("status", [
      "pending",
      "approved",
    ])
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existing =
    existingData as AgencyHostRow | null;

  if (existing) {
    if (
      existing.agency_id === agencyId
    ) {
      throw new AppError(
        409,
        "You already requested to join this agency",
        {
          code:
            "AGENCY_REQUEST_ALREADY_EXISTS",
        },
      );
    }

    throw new AppError(
      409,
      "You already belong to or have a pending request for another agency",
      {
        code:
          "AGENCY_MEMBERSHIP_ALREADY_EXISTS",
      },
    );
  }

  const {
    data: insertedData,
    error,
  } = await supabase
    .from("agency_hosts")
    .insert({
      agency_id: agencyId,
      host_id: userId,
      status: "pending",
    })
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "Agency request already exists",
        {
          code:
            "AGENCY_REQUEST_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  const inserted =
    insertedData as AgencyHostRow;

  return {
    agencyId: inserted.agency_id,
    status: inserted.status,
    createdAt: inserted.joined_at,
  };
}

export async function leaveAgency(
  userId: string,
): Promise<void> {
  const {
    data,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("host_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const membership =
    data as AgencyHostRow | null;

  if (!membership) {
    throw new AppError(
      404,
      "You are not an active agency member",
      {
        code:
          "AGENCY_MEMBERSHIP_NOT_FOUND",
      },
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "left",
    })
    .eq("agency_id", membership.agency_id)
    .eq("host_id", userId)
    .eq("status", "approved");

  if (updateError) {
    throw updateError;
  }

  await syncAgencyHostCount(
    membership.agency_id,
  );
}

export async function getAgencyApplications(
  userId: string,
  agencyId: string,
) {
  await assertAgencyOwner(
    userId,
    agencyId,
  );

  const {
    data,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("agency_id", agencyId)
    .eq("status", "pending")
    .order("joined_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const applications: AgencyHostRow[] =
    (data ?? []) as AgencyHostRow[];

  const userIds = applications.map(
    (application: AgencyHostRow) =>
      application.host_id,
  );

  if (userIds.length === 0) {
    return [];
  }

  const {
    data: profileData,
    error: profilesError,
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
        level
      `,
    )
    .in("id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profiles: AgencyProfileRow[] =
    (profileData ?? []) as AgencyProfileRow[];

  const profileMap =
    new Map<string, AgencyProfileRow>(
      profiles.map(
        (
          profile: AgencyProfileRow,
        ) => [
          profile.id,
          profile,
        ],
      ),
    );

  return applications
    .map(
      (
        application: AgencyHostRow,
      ) => {
        const profile =
          profileMap.get(
            application.host_id,
          );

        if (!profile) {
          return null;
        }

        return {
          userId: profile.id,
          name: profile.name,
          handle: profile.handle,
          avatar: profile.avatar,
          country: profile.country,
          countryFlag:
            profile.country_flag,
          level: profile.level ?? 1,
          status:
            application.status,
          createdAt:
            application.joined_at,
        };
      },
    )
    .filter(
      (
        application,
      ): application is NonNullable<
        typeof application
      > =>
        application !== null,
    );
}

export async function approveAgencyApplication(
  ownerId: string,
  agencyId: string,
  hostId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const application =
    data as AgencyHostRow | null;

  if (!application) {
    throw new AppError(
      404,
      "Pending application not found",
      {
        code:
          "AGENCY_APPLICATION_NOT_FOUND",
      },
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "approved",
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }

  await syncAgencyHostCount(
    agencyId,
  );
}

export async function rejectAgencyApplication(
  ownerId: string,
  agencyId: string,
  hostId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      `
        agency_id,
        host_id,
        status,
        joined_at
      `,
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const application =
    data as AgencyHostRow | null;

  if (!application) {
    throw new AppError(
      404,
      "Pending application not found",
      {
        code:
          "AGENCY_APPLICATION_NOT_FOUND",
      },
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "rejected",
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }
}

async function assertAgencyOwner(
  userId: string,
  agencyId: string,
): Promise<void> {
  const {
    data,
    error,
  } = await supabase
    .from("agencies")
    .select(
      "id, owner_id",
    )
    .eq("id", agencyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const agency =
    data as AgencyOwnerRow | null;

  if (!agency) {
    throw new AppError(
      404,
      "Agency not found",
      {
        code: "AGENCY_NOT_FOUND",
      },
    );
  }

  if (agency.owner_id !== userId) {
    throw new AppError(
      403,
      "Agency owner permission required",
      {
        code:
          "AGENCY_OWNER_REQUIRED",
      },
    );
  }
}

async function syncAgencyHostCount(
  agencyId: string,
): Promise<void> {
  const {
    count,
    error,
  } = await supabase
    .from("agency_hosts")
    .select(
      "host_id",
      {
        count: "exact",
        head: true,
      },
    )
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  const {
    error: updateError,
  } = await supabase
    .from("agencies")
    .update({
      total_hosts: count ?? 0,
    })
    .eq("id", agencyId);

  if (updateError) {
    throw updateError;
  }
}