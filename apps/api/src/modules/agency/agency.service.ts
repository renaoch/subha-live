// File: apps/api/src/modules/agency/agency.service.ts

import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";

import type {
  Agency,
  AgencyHost,
  AgencySummary,
  AgencyMember,
  MyAgencyResult,
  AgencyDetailsResult,
  AgencyApplicationResult,
  AgencyListResult,
  AgencyAgent,
  AgencyInvitation,
  AgencyDashboard,
  AgencyTask,
  AgencyTaskWithAssignment,
  ClaimAgencyTaskResult,
  Payout,
  PayoutStatus,
} from "./agency.types";

import type { CreateAgencyTaskInput } from "./agency.schema";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

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
  | "agent_id"
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

function toAgencyInvitationStatus(
  status: string,
): AgencyInvitation["status"] {
  const allowed: AgencyInvitation["status"][] = [
    "pending",
    "accepted",
    "rejected",
    "cancelled",
    "expired",
  ];

  if (
    allowed.includes(
      status as AgencyInvitation["status"],
    )
  ) {
    return status as AgencyInvitation["status"];
  }

  throw new AppError(
    500,
    `Invalid agency invitation status: ${status}`,
    {
      code:
        "INVALID_INVITATION_STATUS",
    },
  );
}

function toAgencyMembershipStatus(
  status: string | null,
): MyAgencyResult["membershipStatus"] {
  switch (status) {
    case null:
      return null;

    case "pending":
      return "pending";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    case "suspended":
      return "suspended";

    case "left":
      return "left";

    default:
      throw new AppError(
        500,
        `Invalid agency membership status: ${status}`,
        {
          code:
            "INVALID_AGENCY_MEMBERSHIP_STATUS",
        },
      );
  }
}

function toAgencyApplicationStatus(
  status: string | null,
): AgencyApplicationResult["status"] {
  switch (status) {
    case null:
      return null;

    case "pending":
      return "pending";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    case "cancelled":
      return "cancelled";

    default:
      throw new AppError(
        500,
        `Invalid agency application status: ${status}`,
        {
          code:
            "INVALID_AGENCY_APPLICATION_STATUS",
        },
      );
  }
}
function toAgencyAgentStatus(
  status: string,
): AgencyAgent["status"] {
  const allowed: AgencyAgent["status"][] = [
    "active",
    "suspended",
    "removed",
  ];

  if (
    allowed.includes(
      status as AgencyAgent["status"],
    )
  ) {
    return status as AgencyAgent["status"];
  }

  throw new AppError(
    500,
    `Invalid agency agent status: ${status}`,
    {
      code: "INVALID_AGENT_STATUS",
    },
  );
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function toAgencySummary(
  agency: AgencyRow,
): AgencySummary {
  return {
    id: agency.id,
    name: agency.name,
    ownerId: agency.owner_id,
    commissionRate:
      agency.commission_rate ?? 0,
    monthlyRevenue:
      agency.monthly_revenue ?? 0,
    totalHosts:
      agency.total_hosts ?? 0,
    createdAt: agency.created_at,
  };
}

/* ========================================================================== */
/* AGENCY DISCOVERY                                                           */
/* ========================================================================== */

export async function getAgencies(): Promise<AgencyListResult> {
  const { data, error } = await supabase
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
    agencies: rows.map(toAgencySummary),
  };
}

/* ========================================================================== */
/* CURRENT USER AGENCY                                                        */
/* ========================================================================== */

export async function getMyAgency(
  userId: string,
): Promise<MyAgencyResult> {
  /*
   * 1. Check whether the user is already a host.
   *
   * Pending and approved memberships both count here.
   * This preserves your existing approval workflow.
   */
  const {
    data: hostRows,
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status, joined_at",
    )
    .eq("host_id", userId)
    .in("status", [
      "pending",
      "approved",
    ])
    .order("joined_at", {
      ascending: false,
    })
    .limit(1);

  if (hostError) {
    throw hostError;
  }

  const membership =
    hostRows &&
    hostRows.length > 0
      ? hostRows[0]
      : null;

  /*
   * 2. If the user is not a host, check whether
   *    they own an ACTIVE agency.
   *
   * IMPORTANT:
   * is_active = true is required.
   *
   * Previously this query searched only by owner_id,
   * which allowed old inactive agencies such as
   * "Aria Studios" to be returned.
   */
  if (!membership) {
    const {
      data: ownerRows,
      error: ownerError,
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
      .eq("owner_id", userId)
      .eq("is_active", true)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (ownerError) {
      throw ownerError;
    }

    const ownerData =
      ownerRows &&
      ownerRows.length > 0
        ? ownerRows[0]
        : null;

    /*
     * User owns an active agency.
     */
    if (ownerData) {
      return {
        agency:
          toAgencySummary(
            ownerData as AgencyRow,
          ),
        membershipStatus:
          "approved",
      };
    }

    /*
     * User is neither an agency host
     * nor the owner of an active agency.
     */
    return {
      agency: null,
      membershipStatus: null,
    };
  }

  /*
   * 3. Host case.
   *
   * Fetch the agency associated with the
   * user's membership.
   */
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
    .eq("is_active", true)
    .single();

  if (agencyError) {
    if (
      agencyError.code ===
      "PGRST116"
    ) {
      throw new AppError(
        404,
        "Agency not found",
        {
          code:
            "AGENCY_NOT_FOUND",
        },
      );
    }

    throw agencyError;
  }

  return {
    agency:
      toAgencySummary(
        agencyData as AgencyRow,
      ),
    membershipStatus:
      toAgencyMembershipStatus(
        membership.status,
      ),
  };
}
/* ========================================================================== */
/* AGENCY DETAILS                                                             */
/* ========================================================================== */

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
        joined_at,
        agent_id
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
    (member) => member.host_id,
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
      profiles.map((profile) => [
        profile.id,
        profile,
      ]),
    );

  const resultMembers: AgencyMember[] =
    memberships
      .map(
        (
          member,
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
            agentId:
              member.agent_id ?? null,
          };
        },
      )
      .filter(
        (
          member,
        ): member is AgencyMember =>
          member !== null,
      );

  return {
    agency: toAgencySummary(agency),
    members: resultMembers,
  };
}

/* ========================================================================== */
/* JOIN AGENCY                                                                */
/* ========================================================================== */

/**
 * Normal user:
 *
 * 1. Provides agency ID.
 * 2. Provides private agency code.
 * 3. Backend validates the code.
 * 4. Creates agency_hosts.status = pending.
 * 5. Owner must approve.
 *
 * This function NEVER creates an approved membership.
 */
export async function requestAgencyJoin(
  userId: string,
  agencyId: string,
  code: string,
): Promise<AgencyApplicationResult> {
  const normalizedCode =
    code.trim();

  if (!normalizedCode) {
    throw new AppError(
      400,
      "Agency code is required",
      {
        code: "AGENCY_CODE_REQUIRED",
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 1. Verify agency + private code                                         */
  /* ------------------------------------------------------------------------ */

  const {
    data: agencyData,
    error: agencyError,
  } = await supabase
    .from("agencies")
    .select("id, code")
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

  if (agencyData.code !== normalizedCode) {
    throw new AppError(
      403,
      "Invalid agency code",
      {
        code: "INVALID_AGENCY_CODE",
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 2. Check existing membership                                            */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* 3. Create PENDING membership                                             */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* 4. Audit                                                                 */
  /* ------------------------------------------------------------------------ */

  await logAudit({
    actorId: userId,
    agencyId,
    action:
      "AGENCY_APPLICATION_CREATED",
    entityType: "agency_hosts",
    entityId: userId,
    newValue: {
      status: "pending",
    },
  });

  return {
    agencyId: inserted.agency_id,
    status: toAgencyApplicationStatus(
      inserted.status,
    ),
    createdAt: inserted.joined_at,
  };
}

/* ========================================================================== */
/* LEAVE / CANCEL APPLICATION                                                */
/* ========================================================================== */

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
    throw new AppError(
      404,
      "You do not have an active agency application or membership",
      {
        code:
          "AGENCY_MEMBERSHIP_NOT_FOUND",
      },
    );
  }

  /*
   * Pending:
   *
   * Cancel the application.
   *
   * We keep the row with status = rejected
   * rather than deleting historical membership
   * information.
   */

  if (
    membership.status === "pending"
  ) {
    const {
      error: updateError,
    } = await supabase
      .from("agency_hosts")
      .update({
        status: "rejected",
      })
      .eq(
        "agency_id",
        membership.agency_id,
      )
      .eq(
        "host_id",
        userId,
      )
      .eq(
        "status",
        "pending",
      );

    if (updateError) {
      throw updateError;
    }

    await logAudit({
      actorId: userId,
      agencyId: membership.agency_id,
      action:
        "AGENCY_APPLICATION_CANCELLED",
      entityType: "agency_hosts",
      entityId: userId,
      oldValue: {
        status: "pending",
      },
      newValue: {
        status: "rejected",
      },
    });

    return;
  }

  /* ------------------------------------------------------------------------ */
  /* Approved member leaving                                                  */
  /* ------------------------------------------------------------------------ */

  const {
    error: updateError,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "left",
    })
    .eq(
      "agency_id",
      membership.agency_id,
    )
    .eq(
      "host_id",
      userId,
    )
    .eq(
      "status",
      "approved",
    );

  if (updateError) {
    throw updateError;
  }

  await syncAgencyHostCount(
    membership.agency_id,
  );

  await logAudit({
    actorId: userId,
    agencyId: membership.agency_id,
    action:
      "AGENCY_MEMBERSHIP_LEFT",
    entityType: "agency_hosts",
    entityId: userId,
    oldValue: {
      status: "approved",
    },
    newValue: {
      status: "left",
    },
  });
}

/* ========================================================================== */
/* APPLICATIONS                                                               */
/* ========================================================================== */

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

  const userIds =
    applications.map(
      (application) =>
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
      profiles.map((profile) => [
        profile.id,
        profile,
      ]),
    );

 return applications
  .map((application) => {
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
      level:
        profile.level ?? 1,
      status:
        application.status,
      createdAt:
        application.joined_at,
    };
  })
  .filter(
    (
      application,
    ): application is NonNullable<
      typeof application
    > => application !== null,
  );
}

/* ========================================================================== */
/* APPROVE APPLICATION                                                        */
/* ========================================================================== */

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

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_APPLICATION_APPROVED",
    entityType: "agency_hosts",
    entityId: hostId,
    oldValue: {
      status: "pending",
    },
    newValue: {
      status: "approved",
    },
  });
}

/* ========================================================================== */
/* REJECT APPLICATION                                                         */
/* ========================================================================== */

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

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_APPLICATION_REJECTED",
    entityType: "agency_hosts",
    entityId: hostId,
    oldValue: {
      status: "pending",
    },
    newValue: {
      status: "rejected",
    },
  });
}

/* ========================================================================== */
/* OWNER AUTHORIZATION                                                        */
/* ========================================================================== */

export async function assertAgencyOwner(
  userId: string,
  agencyId: string,
): Promise<void> {
  const {
    data,
    error,
  } = await supabase
    .from("agencies")
    .select("id, owner_id")
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

/* ========================================================================== */
/* ADMIN AUTHORIZATION                                                        */
/* ========================================================================== */

async function assertAdmin(
  userId: string,
): Promise<void> {
  const {
    data,
    error,
  } = await supabase
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

/* ========================================================================== */
/* HOST COUNT                                                                 */
/* ========================================================================== */

async function syncAgencyHostCount(
  agencyId: string,
): Promise<void> {
  const {
    count,
    error,
  } = await supabase
    .from("agency_hosts")
    .select("host_id", {
      count: "exact",
      head: true,
    })
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

/* ========================================================================== */
/* AGENTS                                                                     */
/* ========================================================================== */

interface AgentRow {
  id: string;
  agency_id: string;
  user_id: string;
  commission_rate: number;
  status: string;
  created_at: string;
}

export async function listAgents(
  agencyId: string,
): Promise<AgencyAgent[]> {
  const {
    data,
    error,
  } = await (
    supabase.from(
      "agency_agents" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        user_id,
        commission_rate,
        status,
        created_at
      `,
    )
    .eq("agency_id", agencyId)
    .neq("status", "removed")
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const rows: AgentRow[] =
    (data ?? []) as AgentRow[];

  if (rows.length === 0) {
    return [];
  }

  const userIds =
    rows.map((row) => row.user_id);

  const {
    data: profileData,
    error: profilesError,
  } = await supabase
    .from("profiles")
    .select(
      "id, name, handle, avatar",
    )
    .in("id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap =
    new Map(
      (profileData ?? []).map(
        (profile: any) => [
          profile.id,
          profile,
        ],
      ),
    );

  const {
    data: hostCounts,
    error: hostCountsError,
  } = await supabase
    .from("agency_hosts")
    .select("agent_id")
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (hostCountsError) {
    throw hostCountsError;
  }

  const countByAgent =
    new Map<string, number>();

  for (const row of hostCounts ?? []) {
    const agentId = (
      row as {
        agent_id:
          | string
          | null;
      }
    ).agent_id;

    if (!agentId) {
      continue;
    }

    countByAgent.set(
      agentId,
      (countByAgent.get(agentId) ?? 0) +
        1,
    );
  }

  return rows.map((row) => {
    const profile =
      profileMap.get(
        row.user_id,
      ) as
        | {
            id: string;
            name: string;
            handle: string;
            avatar: string | null;
          }
        | undefined;

    return {
      id: row.id,
      agencyId: row.agency_id,
      userId: row.user_id,
      name:
        profile?.name ??
        "Unknown",
      handle:
        profile?.handle ??
        "",
      avatar:
        profile?.avatar ??
        null,
      commissionRate:
        Number(
          row.commission_rate ?? 0,
        ),
      status: toAgencyAgentStatus(
        row.status,
      ),
      hostCount:
        countByAgent.get(
          row.id,
        ) ?? 0,
      createdAt:
        row.created_at,
    };
  });
}

export async function addAgent(
  ownerId: string,
  agencyId: string,
  userId: string,
  commissionRate = 0,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new AppError(
      404,
      "User not found",
      {
        code: "USER_NOT_FOUND",
      },
    );
  }

  const {
    error,
  } = await (
    supabase.from(
      "agency_agents" as any,
    ) as any
  ).insert({
    agency_id: agencyId,
    user_id: userId,
    commission_rate:
      commissionRate,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "This user is already an agent for this agency",
        {
          code:
            "AGENT_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action: "AGENT_CREATED",
    entityType: "agency_agents",
    entityId: userId,
    newValue: {
      commissionRate,
    },
  });
}

export async function removeAgent(
  ownerId: string,
  agencyId: string,
  agentId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    error,
  } = await (
    supabase.from(
      "agency_agents" as any,
    ) as any
  )
    .update({
      status: "removed",
    })
    .eq("id", agentId)
    .eq("agency_id", agencyId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action: "AGENT_REMOVED",
    entityType: "agency_agents",
    entityId: agentId,
  });
}

export async function suspendAgent(
  ownerId: string,
  agencyId: string,
  agentId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    error,
  } = await (
    supabase.from(
      "agency_agents" as any,
    ) as any
  )
    .update({
      status: "suspended",
    })
    .eq("id", agentId)
    .eq("agency_id", agencyId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action: "AGENT_SUSPENDED",
    entityType: "agency_agents",
    entityId: agentId,
  });
}

/* ========================================================================== */
/* HOST ↔ AGENT ASSIGNMENT                                                    */
/* ========================================================================== */

export async function assignAgentToHost(
  ownerId: string,
  agencyId: string,
  hostId: string,
  agentId: string | null,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  if (agentId) {
    const {
      data: agent,
      error: agentError,
    } = await (
      supabase.from(
        "agency_agents" as any,
      ) as any
    )
      .select(
        "id, status",
      )
      .eq("id", agentId)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (agentError) {
      throw agentError;
    }

    if (!agent) {
      throw new AppError(
        404,
        "Agent not found",
        {
          code:
            "AGENT_NOT_FOUND",
        },
      );
    }

    if (agent.status !== "active") {
      throw new AppError(
        409,
        "Cannot assign a suspended or removed agent",
        {
          code:
            "AGENT_NOT_ACTIVE",
        },
      );
    }
  }

  const {
    data: host,
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .eq("status", "approved")
    .maybeSingle();

  if (hostError) {
    throw hostError;
  }

  if (!host) {
    throw new AppError(
      404,
      "Approved host not found",
      {
        code:
          "AGENCY_HOST_NOT_FOUND",
      },
    );
  }

  const {
    error,
  } = await supabase
    .from("agency_hosts")
    .update({
      agent_id: agentId,
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_HOST_AGENT_ASSIGNED",
    entityType: "agency_hosts",
    entityId: hostId,
    newValue: {
      agentId,
    },
  });
}

/* ========================================================================== */
/* SUSPEND HOST                                                               */
/* ========================================================================== */

export async function suspendAgencyHost(
  ownerId: string,
  agencyId: string,
  hostId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data: host,
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (hostError) {
    throw hostError;
  }

  if (!host) {
    throw new AppError(
      404,
      "Agency host not found",
      {
        code:
          "AGENCY_HOST_NOT_FOUND",
      },
    );
  }

  if (
    host.status !== "approved"
  ) {
    throw new AppError(
      409,
      "Only approved hosts can be suspended",
      {
        code:
          "AGENCY_HOST_NOT_APPROVED",
      },
    );
  }

  const {
    error,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "suspended",
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId);

  if (error) {
    throw error;
  }

  await syncAgencyHostCount(
    agencyId,
  );

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_HOST_SUSPENDED",
    entityType: "agency_hosts",
    entityId: hostId,
    oldValue: {
      status: "approved",
    },
    newValue: {
      status: "suspended",
    },
  });
}

/* ========================================================================== */
/* RESTORE HOST                                                               */
/* ========================================================================== */

export async function restoreAgencyHost(
  ownerId: string,
  agencyId: string,
  hostId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data: host,
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (hostError) {
    throw hostError;
  }

  if (!host) {
    throw new AppError(
      404,
      "Agency host not found",
      {
        code:
          "AGENCY_HOST_NOT_FOUND",
      },
    );
  }

  if (
    host.status !== "suspended"
  ) {
    throw new AppError(
      409,
      "Only suspended hosts can be restored",
      {
        code:
          "AGENCY_HOST_NOT_SUSPENDED",
      },
    );
  }

  const {
    error,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "approved",
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId);

  if (error) {
    throw error;
  }

  await syncAgencyHostCount(
    agencyId,
  );

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_HOST_RESTORED",
    entityType: "agency_hosts",
    entityId: hostId,
    oldValue: {
      status: "suspended",
    },
    newValue: {
      status: "approved",
    },
  });
}

/* ========================================================================== */
/* REMOVE HOST                                                                */
/* ========================================================================== */

export async function removeAgencyHost(
  ownerId: string,
  agencyId: string,
  hostId: string,
): Promise<void> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data: host,
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("agency_id", agencyId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (hostError) {
    throw hostError;
  }

  if (!host) {
    throw new AppError(
      404,
      "Agency host not found",
      {
        code:
          "AGENCY_HOST_NOT_FOUND",
      },
    );
  }

  if (
    host.status === "left" ||
    host.status === "removed"
  ) {
    throw new AppError(
      409,
      "Host is already removed from the agency",
      {
        code:
          "AGENCY_HOST_ALREADY_REMOVED",
      },
    );
  }

  const {
    error,
  } = await supabase
    .from("agency_hosts")
    .update({
      status: "left",
      agent_id: null,
    })
    .eq("agency_id", agencyId)
    .eq("host_id", hostId);

  if (error) {
    throw error;
  }

  await syncAgencyHostCount(
    agencyId,
  );

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_HOST_REMOVED",
    entityType: "agency_hosts",
    entityId: hostId,
    oldValue: {
      status: host.status,
    },
    newValue: {
      status: "left",
    },
  });
}

/* ========================================================================== */
/* INVITATIONS                                                                */
/* ========================================================================== */

interface InvitationRow {
  id: string;
  agency_id: string;
  host_id: string;
  invited_by: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  expires_at: string | null;
}

async function hydrateInvitations(
  rows: InvitationRow[],
): Promise<AgencyInvitation[]> {
  if (rows.length === 0) {
    return [];
  }

  const agencyIds = [
    ...new Set(
      rows.map(
        (row) => row.agency_id,
      ),
    ),
  ];

  const hostIds = [
    ...new Set(
      rows.map(
        (row) => row.host_id,
      ),
    ),
  ];

  const [
    {
      data: agencyData,
    },
    {
      data: profileData,
    },
  ] = await Promise.all([
    supabase
      .from("agencies")
      .select("id, name")
      .in("id", agencyIds),

    supabase
      .from("profiles")
      .select(
        "id, name, handle, avatar",
      )
      .in("id", hostIds),
  ]);

  const agencyMap =
    new Map(
      (agencyData ?? []).map(
        (agency: any) => [
          agency.id,
          agency,
        ],
      ),
    );

  const profileMap =
    new Map(
      (profileData ?? []).map(
        (profile: any) => [
          profile.id,
          profile,
        ],
      ),
    );

  return rows.map((row) => {
    const agency =
      agencyMap.get(
        row.agency_id,
      ) as
        | {
            id: string;
            name: string;
          }
        | undefined;

    const profile =
      profileMap.get(
        row.host_id,
      ) as
        | {
            id: string;
            name: string;
            handle: string;
            avatar: string | null;
          }
        | undefined;

    return {
      id: row.id,
      agencyId: row.agency_id,
      agencyName:
        agency?.name ??
        "Unknown agency",
      hostId: row.host_id,
      hostName:
        profile?.name ??
        "Unknown",
      hostHandle:
        profile?.handle ??
        "",
      hostAvatar:
        profile?.avatar ??
        null,
      invitedBy:
        row.invited_by,
      status: toAgencyInvitationStatus(
        row.status,
      ),
      createdAt:
        row.created_at,
      respondedAt:
        row.responded_at,
      expiresAt:
        row.expires_at,
    };
  });
}

export async function createInvitation(
  actorId: string,
  agencyId: string,
  hostId: string,
  expiresInDays = 7,
): Promise<void> {
  const {
    data: agencyData,
    error: agencyError,
  } = await supabase
    .from("agencies")
    .select("id, owner_id")
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

  /*
   * Owner or active agent can invite.
   */

  if (
    (agencyData as AgencyOwnerRow)
      .owner_id !== actorId
  ) {
    const {
      data: agentRow,
      error: agentError,
    } = await (
      supabase.from(
        "agency_agents" as any,
      ) as any
    )
      .select("id")
      .eq("agency_id", agencyId)
      .eq("user_id", actorId)
      .eq("status", "active")
      .maybeSingle();

    if (agentError) {
      throw agentError;
    }

    if (!agentRow) {
      throw new AppError(
        403,
        "Agency owner or agent permission required",
        {
          code:
            "AGENCY_PERMISSION_REQUIRED",
        },
      );
    }
  }

  const {
    data: existingMembership,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("host_id", hostId)
    .in("status", [
      "pending",
      "approved",
    ])
    .maybeSingle();

  if (existingMembership) {
    throw new AppError(
      409,
      "This user already belongs to or has a pending request for an agency",
      {
        code:
          "AGENCY_MEMBERSHIP_ALREADY_EXISTS",
      },
    );
  }

  const expiresAt =
    new Date(
      Date.now() +
        expiresInDays *
          24 *
          60 *
          60 *
          1000,
    ).toISOString();

  const {
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  ).insert({
    agency_id: agencyId,
    host_id: hostId,
    invited_by: actorId,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "This host already has a pending invitation from this agency",
        {
          code:
            "INVITATION_ALREADY_EXISTS",
        },
      );
    }

    throw error;
  }

  await logAudit({
    actorId,
    agencyId,
    action:
      "AGENCY_INVITATION_CREATED",
    entityType:
      "agency_invitations",
    entityId: hostId,
  });
}

export async function listAgencyInvitations(
  ownerId: string,
  agencyId: string,
): Promise<AgencyInvitation[]> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data,
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        host_id,
        invited_by,
        status,
        created_at,
        responded_at,
        expires_at
      `,
    )
    .eq("agency_id", agencyId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return hydrateInvitations(
    (data ??
      []) as InvitationRow[],
  );
}

export async function listMyInvitations(
  hostId: string,
): Promise<AgencyInvitation[]> {
  const {
    data,
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        host_id,
        invited_by,
        status,
        created_at,
        responded_at,
        expires_at
      `,
    )
    .eq("host_id", hostId)
    .eq("status", "pending")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return hydrateInvitations(
    (data ??
      []) as InvitationRow[],
  );
}

async function getInvitationOrThrow(
  invitationId: string,
): Promise<InvitationRow> {
  const {
    data,
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        host_id,
        invited_by,
        status,
        created_at,
        responded_at,
        expires_at
      `,
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(
      404,
      "Invitation not found",
      {
        code:
          "INVITATION_NOT_FOUND",
      },
    );
  }

  return data as InvitationRow;
}

export async function acceptInvitation(
  hostId: string,
  invitationId: string,
): Promise<void> {
  const invitation =
    await getInvitationOrThrow(
      invitationId,
    );

  if (
    invitation.host_id !== hostId
  ) {
    throw new AppError(
      403,
      "This invitation does not belong to you",
      {
        code:
          "INVITATION_FORBIDDEN",
      },
    );
  }

  if (
    invitation.status !== "pending"
  ) {
    throw new AppError(
      409,
      "This invitation is no longer pending",
      {
        code:
          "INVITATION_NOT_PENDING",
      },
    );
  }

  if (
    invitation.expires_at &&
    new Date(
      invitation.expires_at,
    ).getTime() <= Date.now()
  ) {
    throw new AppError(
      409,
      "This invitation has expired",
      {
        code:
          "INVITATION_EXPIRED",
      },
    );
  }

  const {
    data: existingMembership,
  } = await supabase
    .from("agency_hosts")
    .select(
      "agency_id, host_id, status",
    )
    .eq("host_id", hostId)
    .in("status", [
      "pending",
      "approved",
    ])
    .maybeSingle();

  if (existingMembership) {
    throw new AppError(
      409,
      "You already belong to or have a pending request for an agency",
      {
        code:
          "AGENCY_MEMBERSHIP_ALREADY_EXISTS",
      },
    );
  }

  const {
    error: hostError,
  } = await supabase
    .from("agency_hosts")
    .insert({
      agency_id:
        invitation.agency_id,
      host_id: hostId,
      status: "approved",
    });

  if (hostError) {
    throw hostError;
  }

  const {
    error: invitationError,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .update({
      status: "accepted",
      responded_at:
        new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (invitationError) {
    throw invitationError;
  }

  await syncAgencyHostCount(
    invitation.agency_id,
  );

  await logAudit({
    actorId: hostId,
    agencyId:
      invitation.agency_id,
    action:
      "AGENCY_INVITATION_ACCEPTED",
    entityType:
      "agency_invitations",
    entityId: invitationId,
  });
}

export async function rejectInvitation(
  hostId: string,
  invitationId: string,
): Promise<void> {
  const invitation =
    await getInvitationOrThrow(
      invitationId,
    );

  if (
    invitation.host_id !== hostId
  ) {
    throw new AppError(
      403,
      "This invitation does not belong to you",
      {
        code:
          "INVITATION_FORBIDDEN",
      },
    );
  }

  if (
    invitation.status !== "pending"
  ) {
    throw new AppError(
      409,
      "This invitation is no longer pending",
      {
        code:
          "INVITATION_NOT_PENDING",
      },
    );
  }

  const {
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .update({
      status: "rejected",
      responded_at:
        new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: hostId,
    agencyId:
      invitation.agency_id,
    action:
      "AGENCY_INVITATION_REJECTED",
    entityType:
      "agency_invitations",
    entityId: invitationId,
  });
}

export async function cancelInvitation(
  actorId: string,
  invitationId: string,
): Promise<void> {
  const invitation =
    await getInvitationOrThrow(
      invitationId,
    );

  await assertAgencyOwner(
    actorId,
    invitation.agency_id,
  );

  if (
    invitation.status !== "pending"
  ) {
    throw new AppError(
      409,
      "This invitation is no longer pending",
      {
        code:
          "INVITATION_NOT_PENDING",
      },
    );
  }

  const {
    error,
  } = await (
    supabase.from(
      "agency_invitations" as any,
    ) as any
  )
    .update({
      status: "cancelled",
      responded_at:
        new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: actorId,
    agencyId:
      invitation.agency_id,
    action:
      "AGENCY_INVITATION_CANCELLED",
    entityType:
      "agency_invitations",
    entityId: invitationId,
  });
}

/* ========================================================================== */
/* DASHBOARD                                                                  */
/* ========================================================================== */

export async function getAgencyDashboard(
  ownerId: string,
  agencyId: string,
): Promise<AgencyDashboard> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

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
    throw agencyError;
  }

  const [
    { count: activeHosts },
    { count: agentCount },
    { count: pendingApplications },
    { count: pendingInvitations },
    { count: activeTasks },
    { count: pendingPayouts },
  ] = await Promise.all([
    supabase
      .from("agency_hosts")
      .select(
        "host_id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "approved"),

    (
      supabase.from(
        "agency_agents" as any,
      ) as any
    )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "active"),

    supabase
      .from("agency_hosts")
      .select(
        "host_id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "pending"),

    (
      supabase.from(
        "agency_invitations" as any,
      ) as any
    )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "pending"),

    (
      supabase.from(
        "agency_tasks" as any,
      ) as any
    )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "active"),

    (
      supabase.from(
        "payouts" as any,
      ) as any
    )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("agency_id", agencyId)
      .eq("status", "requested"),
  ]);

  const agency =
    toAgencySummary(
      agencyData as AgencyRow,
    );

  return {
    agency,
    totalHosts:
      agency.totalHosts,
    activeHosts:
      activeHosts ?? 0,
    agentCount:
      agentCount ?? 0,
    pendingApplications:
      pendingApplications ?? 0,
    pendingInvitations:
      pendingInvitations ?? 0,
    activeTasks:
      activeTasks ?? 0,
    pendingPayouts:
      pendingPayouts ?? 0,
  };
}

/* ========================================================================== */
/* TASKS                                                                      */
/* ========================================================================== */

interface AgencyTaskRow {
  id: string;
  agency_id: string;
  title: string;
  description: string | null;
  type: string;
  target_value: number;
  reward_coins: number;
  reward_diamonds: number;
  start_at: string;
  end_at: string | null;
  status: string;
  created_at: string;
}

interface AgencyTaskAssignmentRow {
  id: string;
  task_id: string;
  host_id: string;
  progress: number;
  status: string;
  completed_at: string | null;
  claimed_at: string | null;
}

export async function createAgencyTask(
  ownerId: string,
  agencyId: string,
  input: CreateAgencyTaskInput,
): Promise<AgencyTask> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data: taskData,
    error: taskError,
  } = await (
    supabase.from(
      "agency_tasks" as any,
    ) as any
  )
    .insert({
      agency_id: agencyId,
      title: input.title,
      description:
        input.description ??
        null,
      type: input.type,
      target_value:
        input.targetValue,
      reward_coins:
        input.rewardCoins ?? 0,
      reward_diamonds:
        input.rewardDiamonds ?? 0,
      end_at:
        input.endAt ?? null,
      status: "active",
      created_by: ownerId,
    })
    .select(
      `
        id,
        agency_id,
        title,
        description,
        type,
        target_value,
        reward_coins,
        reward_diamonds,
        start_at,
        end_at,
        status,
        created_at
      `,
    )
    .single();

  if (taskError) {
    throw taskError;
  }

  const task =
    taskData as AgencyTaskRow;

  const {
    data: hosts,
    error: hostsError,
  } = await supabase
    .from("agency_hosts")
    .select("host_id")
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (hostsError) {
    throw hostsError;
  }

  const assignments =
    (hosts ?? []).map(
      (host: any) => ({
        task_id: task.id,
        host_id: host.host_id,
        progress: 0,
        status:
          "in_progress",
      }),
    );

  if (assignments.length > 0) {
    const {
      error: assignError,
    } = await (
      supabase.from(
        "agency_task_assignments" as any,
      ) as any
    ).insert(assignments);

    if (assignError) {
      throw assignError;
    }
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "AGENCY_TASK_CREATED",
    entityType:
      "agency_tasks",
    entityId: task.id,
    newValue: input,
  });

  return {
    id: task.id,
    agencyId: task.agency_id,
    title: task.title,
    description:
      task.description,
    type: task.type as AgencyTask["type"],
    targetValue:
      task.target_value,
    rewardCoins:
      task.reward_coins,
    rewardDiamonds:
      task.reward_diamonds,
    startAt:
      task.start_at,
    endAt:
      task.end_at,
    status:
      task.status,
    assignedCount:
      assignments.length,
    completedCount: 0,
    createdAt:
      task.created_at,
  };
}

export async function listAgencyTasks(
  agencyId: string,
  viewerId: string,
): Promise<AgencyTaskWithAssignment[]> {
  const {
    data,
    error,
  } = await (
    supabase.from(
      "agency_tasks" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        title,
        description,
        type,
        target_value,
        reward_coins,
        reward_diamonds,
        start_at,
        end_at,
        status,
        created_at
      `,
    )
    .eq("agency_id", agencyId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const tasks: AgencyTaskRow[] =
    (data ?? []) as AgencyTaskRow[];

  if (tasks.length === 0) {
    return [];
  }

  const taskIds =
    tasks.map(
      (task) => task.id,
    );

  const {
    data: assignmentData,
    error: assignmentError,
  } = await (
    supabase.from(
      "agency_task_assignments" as any,
    ) as any
  )
    .select(
      `
        id,
        task_id,
        host_id,
        progress,
        status,
        completed_at,
        claimed_at
      `,
    )
    .in(
      "task_id",
      taskIds,
    );

  if (assignmentError) {
    throw assignmentError;
  }

  const assignments: AgencyTaskAssignmentRow[] =
    (assignmentData ??
      []) as AgencyTaskAssignmentRow[];

const assignmentsByTask =
  new Map<
    string,
    AgencyTaskAssignmentRow[]
  >();

  for (const assignment of assignments) {
    if (
      !assignmentsByTask.has(
        assignment.task_id,
      )
    ) {
      assignmentsByTask.set(
        assignment.task_id,
        [],
      );
    }

    assignmentsByTask
      .get(
        assignment.task_id,
      )!
      .push(assignment);
  }

  return tasks.map((task) => {
    const taskAssignments =
      assignmentsByTask.get(
        task.id,
      ) ?? [];

    const mine =
      taskAssignments.find(
        (assignment) =>
          assignment.host_id ===
          viewerId,
      ) ?? null;

    const completedCount =
      taskAssignments.filter(
        (assignment) =>
          assignment.status ===
            "completed" ||
          assignment.status ===
            "claimed",
      ).length;

    return {
      id: task.id,
      agencyId:
        task.agency_id,
      title: task.title,
      description:
        task.description,
      type: task.type as AgencyTask["type"],
      targetValue:
        task.target_value,
      rewardCoins:
        task.reward_coins,
      rewardDiamonds:
        task.reward_diamonds,
      startAt:
        task.start_at,
      endAt:
        task.end_at,
      status:
        task.status,
      assignedCount:
        taskAssignments.length,
      completedCount,
      createdAt:
        task.created_at,

      assignment: mine
        ? {
            id: mine.id,
            taskId:
              mine.task_id,
            hostId:
              mine.host_id,
            progress:
              mine.progress,
            targetValue:
              task.target_value,
            status:
              mine.status as any,
            completedAt:
              mine.completed_at,
            claimedAt:
              mine.claimed_at,
          }
        : null,
    };
  });
}

/* ========================================================================== */
/* TASK PROGRESS                                                              */
/* ========================================================================== */

export async function incrementAgencyTaskProgress(
  hostId: string,
  taskId: string,
  amount: number,
): Promise<void> {
  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      400,
      "Progress amount must be a positive integer",
      {
        code:
          "INVALID_TASK_PROGRESS",
      },
    );
  }

  const {
    data: taskData,
    error: taskError,
  } = await (
    supabase.from(
      "agency_tasks" as any,
    ) as any
  )
    .select(
      "id, target_value, status",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }

  if (
    !taskData ||
    taskData.status !==
      "active"
  ) {
    throw new AppError(
      404,
      "Task not found or inactive",
      {
        code:
          "TASK_NOT_FOUND",
      },
    );
  }

  const {
    data: assignment,
    error: assignmentError,
  } = await (
    supabase.from(
      "agency_task_assignments" as any,
    ) as any
  )
    .select(
      "id, progress, status",
    )
    .eq("task_id", taskId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (
    !assignment ||
    assignment.status !==
      "in_progress"
  ) {
    return;
  }

  const targetValue =
    taskData.target_value as number;

  const newProgress =
    Math.min(
      targetValue,
      assignment.progress +
        amount,
    );

  const isCompleted =
    newProgress >=
    targetValue;

  const {
    error: updateError,
  } = await (
    supabase.from(
      "agency_task_assignments" as any,
    ) as any
  )
    .update({
      progress: newProgress,
      status: isCompleted
        ? "completed"
        : "in_progress",
      completed_at:
        isCompleted
          ? new Date().toISOString()
          : null,
    })
    .eq(
      "id",
      assignment.id,
    );

  if (updateError) {
    throw updateError;
  }
}

/* ========================================================================== */
/* CLAIM TASK                                                                 */
/* ========================================================================== */

export async function claimAgencyTaskReward(
  hostId: string,
  taskId: string,
): Promise<ClaimAgencyTaskResult> {
  const {
    data: taskData,
    error: taskError,
  } = await (
    supabase.from(
      "agency_tasks" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        reward_coins,
        reward_diamonds
      `,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }

  if (!taskData) {
    throw new AppError(
      404,
      "Task not found",
      {
        code:
          "TASK_NOT_FOUND",
      },
    );
  }

  const {
    data: assignment,
    error: assignmentError,
  } = await (
    supabase.from(
      "agency_task_assignments" as any,
    ) as any
  )
    .select(
      "id, status",
    )
    .eq("task_id", taskId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignment) {
    throw new AppError(
      404,
      "You are not assigned to this task",
      {
        code:
          "TASK_ASSIGNMENT_NOT_FOUND",
      },
    );
  }

  if (
    assignment.status ===
    "claimed"
  ) {
    throw new AppError(
      409,
      "Reward already claimed",
      {
        code:
          "TASK_ALREADY_CLAIMED",
      },
    );
  }

  if (
    assignment.status !==
    "completed"
  ) {
    throw new AppError(
      400,
      "Task has not been completed",
      {
        code:
          "TASK_NOT_COMPLETED",
      },
    );
  }

  const rewardCoins =
    taskData.reward_coins as number;

  const rewardDiamonds =
    taskData.reward_diamonds as number;

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, coins, diamonds",
    )
    .eq("id", hostId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const newCoins =
    (profile.coins ?? 0) +
    rewardCoins;

  const newDiamonds =
    (profile.diamonds ?? 0) +
    rewardDiamonds;

  const {
    error: walletError,
  } = await supabase
    .from("profiles")
    .update({
      coins: newCoins,
      diamonds: newDiamonds,
    })
    .eq("id", hostId);

  if (walletError) {
    throw walletError;
  }

  const {
    error: claimError,
  } = await (
    supabase.from(
      "agency_task_assignments" as any,
    ) as any
  )
    .update({
      status: "claimed",
      claimed_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      assignment.id,
    )
    .eq(
      "status",
      "completed",
    );

  if (claimError) {
    throw claimError;
  }

  await logAudit({
    actorId: hostId,
    agencyId:
      taskData.agency_id,
    action:
      "AGENCY_TASK_CLAIMED",
    entityType:
      "agency_task_assignments",
    entityId:
      assignment.id,
    newValue: {
      rewardCoins,
      rewardDiamonds,
    },
  });

  return {
    taskId,
    rewardCoins,
    rewardDiamonds,
    newCoins,
    newDiamonds,
  };
}

/* ========================================================================== */
/* PAYOUTS                                                                    */
/* ========================================================================== */

interface PayoutRow {
  id: string;
  agency_id: string;
  requested_by: string;
  amount: number;
  status: string;
  note: string | null;
  requested_at: string;
  processed_at: string | null;
  paid_at: string | null;
}

function toPayout(
  row: PayoutRow,
): Payout {
  return {
    id: row.id,
    agencyId:
      row.agency_id,
    requestedBy:
      row.requested_by,
    amount:
      Number(row.amount),
    status:
      row.status as PayoutStatus,
    note: row.note,
    requestedAt:
      row.requested_at,
    processedAt:
      row.processed_at,
    paidAt:
      row.paid_at,
  };
}

export async function requestPayout(
  ownerId: string,
  agencyId: string,
  amount: number,
  note?: string,
): Promise<Payout> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new AppError(
      400,
      "Payout amount must be greater than zero",
      {
        code:
          "INVALID_PAYOUT_AMOUNT",
      },
    );
  }

  const {
    data,
    error,
  } = await (
    supabase.from(
      "payouts" as any,
    ) as any
  )
    .insert({
      agency_id: agencyId,
      requested_by: ownerId,
      amount,
      note:
        note ?? null,
      status:
        "requested",
    })
    .select(
      `
        id,
        agency_id,
        requested_by,
        amount,
        status,
        note,
        requested_at,
        processed_at,
        paid_at
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: ownerId,
    agencyId,
    action:
      "PAYOUT_REQUESTED",
    entityType:
      "payouts",
    entityId:
      (data as PayoutRow)
        .id,
    newValue: {
      amount,
      note,
    },
  });

  return toPayout(
    data as PayoutRow,
  );
}

export async function listPayouts(
  ownerId: string,
  agencyId: string,
): Promise<Payout[]> {
  await assertAgencyOwner(
    ownerId,
    agencyId,
  );

  const {
    data,
    error,
  } = await (
    supabase.from(
      "payouts" as any,
    ) as any
  )
    .select(
      `
        id,
        agency_id,
        requested_by,
        amount,
        status,
        note,
        requested_at,
        processed_at,
        paid_at
      `,
    )
    .eq("agency_id", agencyId)
    .order("requested_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as PayoutRow[]
  ).map(toPayout);
}
// File: apps/api/src/modules/agency/agency.service.ts

/**
 * Join agency by private code only.
 * Finds the agency by code, then calls the existing `requestAgencyJoin`.
 */
/* -------------------------------------------------------------------------- */
/* JOIN BY CODE (only code)                                                   */
/* -------------------------------------------------------------------------- */

export async function joinAgencyByCode(
  userId: string,
  code: string,
): Promise<AgencyApplicationResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new AppError(400, "Agency code is required", {
      code: "AGENCY_CODE_REQUIRED",
    });
  }

  // 1. Find the agency by private code
  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id, code")
    .eq("code", trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!agency) {
    throw new AppError(404, "No agency found with that code.", {
      code: "AGENCY_NOT_FOUND_BY_CODE",
    });
  }

  // 2. Reuse the existing join service (validates code again, but fine)
  return await requestAgencyJoin(userId, agency.id, trimmed);
}

export async function adminUpdatePayoutStatus(
  adminUserId: string,
  payoutId: string,
  status: PayoutStatus,
): Promise<Payout> {
  await assertAdmin(
    adminUserId,
  );

  const {
    data: existing,
    error: existingError,
  } = await (
    supabase.from(
      "payouts" as any,
    ) as any
  )
    .select(
      "id, agency_id, status",
    )
    .eq("id", payoutId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw new AppError(
      404,
      "Payout not found",
      {
        code:
          "PAYOUT_NOT_FOUND",
      },
    );
  }

const patch: Record<string, unknown> = {
  status,
};

if (status === "processing") {
  patch.processed_at =
    new Date().toISOString();
}

if (status === "paid") {
  patch.paid_at =
    new Date().toISOString();
}

  if (
    status === "processing"
  ) {
    patch.processed_at =
      new Date().toISOString();
  }

  if (status === "paid") {
    patch.paid_at =
      new Date().toISOString();
  }

  const {
    data,
    error,
  } = await (
    supabase.from(
      "payouts" as any,
    ) as any
  )
    .update(patch)
    .eq("id", payoutId)
    .select(
      `
        id,
        agency_id,
        requested_by,
        amount,
        status,
        note,
        requested_at,
        processed_at,
        paid_at
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  await logAudit({
    actorId: adminUserId,
    agencyId:
      existing.agency_id,
    action:
      "PAYOUT_STATUS_CHANGED",
    entityType:
      "payouts",
    entityId: payoutId,
    oldValue: {
      status:
        existing.status,
    },
    newValue: {
      status,
    },
  });

  return toPayout(
    data as PayoutRow,
  );
}