// File: apps/api/src/modules/agency/agency.controller.ts

import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../errors/app-error";

import {
  getAgencies,
  getMyAgency,
  getAgencyById,
  requestAgencyJoin,
  leaveAgency,
  getAgencyApplications,
  approveAgencyApplication,
  rejectAgencyApplication,
  listAgents,
  addAgent,
  removeAgent,
  suspendAgent,
  assignAgentToHost,
  suspendAgencyHost,
  removeAgencyHost,
  createInvitation,
  listAgencyInvitations,
  listMyInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  getAgencyDashboard,
  createAgencyTask,
  listAgencyTasks,
  claimAgencyTaskReward,
  requestPayout,
  listPayouts,
  adminUpdatePayoutStatus,
} from "./agency.service";

import {
  createAgentSchema,
  assignAgentSchema,
  createInvitationSchema,
  createAgencyTaskSchema,
  requestPayoutSchema,
  updatePayoutStatusSchema,
} from "./agency.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

// ---------------------------------------------------------------------------
// Original endpoints (unchanged behavior)
// ---------------------------------------------------------------------------

export async function listAgencies(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAgencies();
    return res.status(200).json({ status: "ok", agencies: result.agencies });
  } catch (error) {
    next(error);
  }
}

export async function getMyAgencyController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await getMyAgency(user.id);
    return res.status(200).json({ status: "ok", agency: result.agency, membershipStatus: result.membershipStatus });
  } catch (error) {
    next(error);
  }
}

export async function getAgency(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const result = await getAgencyById(req.params.id);
    return res.status(200).json({ status: "ok", agency: result.agency, members: result.members });
  } catch (error) {
    next(error);
  }
}

export async function joinAgency(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await requestAgencyJoin(user.id, req.params.id);
    return res.status(201).json({ status: "ok", application: result });
  } catch (error) {
    next(error);
  }
}

export async function leaveMyAgency(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await leaveAgency(user.id);
    return res.status(200).json({ status: "ok", message: "You have left the agency" });
  } catch (error) {
    next(error);
  }
}

export async function getApplications(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const applications = await getAgencyApplications(user.id, req.params.id);
    return res.status(200).json({ status: "ok", applications });
  } catch (error) {
    next(error);
  }
}

export async function approveApplication(
  req: Request<{ id: string; userId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await approveAgencyApplication(user.id, req.params.id, req.params.userId);
    return res.status(200).json({ status: "ok", message: "Agency application approved" });
  } catch (error) {
    next(error);
  }
}

export async function rejectApplication(
  req: Request<{ id: string; userId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await rejectAgencyApplication(user.id, req.params.id, req.params.userId);
    return res.status(200).json({ status: "ok", message: "Agency application rejected" });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function getAgents(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const agents = await listAgents(req.params.id);
    return res.status(200).json({ status: "ok", agents });
  } catch (error) {
    next(error);
  }
}

export async function createAgent(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = createAgentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid agent payload", {
        code: "INVALID_AGENT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    await addAgent(user.id, req.params.id, parsed.data.userId, parsed.data.commissionRate ?? 0);
    return res.status(201).json({ status: "ok", message: "Agent added" });
  } catch (error) {
    next(error);
  }
}

export async function deleteAgent(req: Request<{ id: string; agentId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await removeAgent(user.id, req.params.id, req.params.agentId);
    return res.status(200).json({ status: "ok", message: "Agent removed" });
  } catch (error) {
    next(error);
  }
}

export async function suspendAgentController(
  req: Request<{ id: string; agentId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await suspendAgent(user.id, req.params.id, req.params.agentId);
    return res.status(200).json({ status: "ok", message: "Agent suspended" });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Host management
// ---------------------------------------------------------------------------

export async function assignHostAgent(req: Request<{ id: string; hostId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = assignAgentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid payload", {
        code: "INVALID_ASSIGN_AGENT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    await assignAgentToHost(user.id, req.params.id, req.params.hostId, parsed.data.agentId);
    return res.status(200).json({ status: "ok", message: "Agent assignment updated" });
  } catch (error) {
    next(error);
  }
}

export async function suspendHost(req: Request<{ id: string; hostId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await suspendAgencyHost(user.id, req.params.id, req.params.hostId);
    return res.status(200).json({ status: "ok", message: "Host suspended" });
  } catch (error) {
    next(error);
  }
}

export async function removeHost(req: Request<{ id: string; hostId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await removeAgencyHost(user.id, req.params.id, req.params.hostId);
    return res.status(200).json({ status: "ok", message: "Host removed from agency" });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createAgencyInvitation(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = createInvitationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid invitation payload", {
        code: "INVALID_INVITATION_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    await createInvitation(user.id, req.params.id, parsed.data.hostId, parsed.data.expiresInDays ?? 7);
    return res.status(201).json({ status: "ok", message: "Invitation sent" });
  } catch (error) {
    next(error);
  }
}

export async function getAgencyInvitations(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const invitations = await listAgencyInvitations(user.id, req.params.id);
    return res.status(200).json({ status: "ok", invitations });
  } catch (error) {
    next(error);
  }
}

export async function getMyInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const invitations = await listMyInvitations(user.id);
    return res.status(200).json({ status: "ok", invitations });
  } catch (error) {
    next(error);
  }
}

export async function acceptAgencyInvitation(
  req: Request<{ invitationId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await acceptInvitation(user.id, req.params.invitationId);
    return res.status(200).json({ status: "ok", message: "Invitation accepted" });
  } catch (error) {
    next(error);
  }
}

export async function rejectAgencyInvitation(
  req: Request<{ invitationId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await rejectInvitation(user.id, req.params.invitationId);
    return res.status(200).json({ status: "ok", message: "Invitation rejected" });
  } catch (error) {
    next(error);
  }
}

export async function cancelAgencyInvitation(
  req: Request<{ invitationId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    await cancelInvitation(user.id, req.params.invitationId);
    return res.status(200).json({ status: "ok", message: "Invitation cancelled" });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const dashboard = await getAgencyDashboard(user.id, req.params.id);
    return res.status(200).json({ status: "ok", dashboard });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = createAgencyTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid task payload", {
        code: "INVALID_TASK_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const task = await createAgencyTask(user.id, req.params.id, parsed.data);
    return res.status(201).json({ status: "ok", task });
  } catch (error) {
    next(error);
  }
}

export async function getTasks(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const tasks = await listAgencyTasks(req.params.id, user.id);
    return res.status(200).json({ status: "ok", tasks });
  } catch (error) {
    next(error);
  }
}

export async function claimTaskReward(req: Request<{ id: string; taskId: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const result = await claimAgencyTaskReward(user.id, req.params.taskId);
    return res.status(200).json({ status: "ok", task: result });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export async function createPayout(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = requestPayoutSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid payout payload", {
        code: "INVALID_PAYOUT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const payout = await requestPayout(user.id, req.params.id, parsed.data.amount, parsed.data.note);
    return res.status(201).json({ status: "ok", payout });
  } catch (error) {
    next(error);
  }
}

export async function getPayouts(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const payouts = await listPayouts(user.id, req.params.id);
    return res.status(200).json({ status: "ok", payouts });
  } catch (error) {
    next(error);
  }
}

export async function updatePayoutStatusController(
  req: Request<{ payoutId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = requireUser(req);
    const parsed = updatePayoutStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Invalid payout status payload", {
        code: "INVALID_PAYOUT_STATUS_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const payout = await adminUpdatePayoutStatus(user.id, req.params.payoutId, parsed.data.status);
    return res.status(200).json({ status: "ok", payout });
  } catch (error) {
    next(error);
  }
}