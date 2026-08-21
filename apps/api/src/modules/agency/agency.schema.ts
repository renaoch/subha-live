// File: apps/api/src/modules/agency/agency.schema.ts

import { z } from "zod";

export const agencyIdSchema = z.object({
  id: z.string().min(1, "Invalid agency ID"),
});

export type AgencyIdInput = z.infer<typeof agencyIdSchema>;

export const agencyHostParamsSchema = z.object({
  id: z.string().min(1, "Invalid agency ID"),
  hostId: z.string().uuid("Invalid host ID"),
});

export const agencyAgentParamsSchema = z.object({
  id: z.string().min(1, "Invalid agency ID"),
  agentId: z.string().uuid("Invalid agent ID"),
});

export const createAgentSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  commissionRate: z.number().min(0).max(100).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const assignAgentSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID").nullable(),
});

export type AssignAgentInput = z.infer<typeof assignAgentSchema>;

export const invitationIdParamsSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation ID"),
});

export const createInvitationSchema = z.object({
  hostId: z.string().uuid("Invalid host ID"),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const taskIdParamsSchema = z.object({
  id: z.string().min(1, "Invalid agency ID"),
  taskId: z.string().uuid("Invalid task ID"),
});

export const createAgencyTaskSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  type: z.enum([
    "stream_hours",
    "stream_days",
    "gift_amount",
    "gift_count",
    "viewer_count",
    "followers",
    "live_sessions",
    "recruit_hosts",
    "custom",
  ]),
  targetValue: z.number().int().min(1),
  rewardCoins: z.number().int().min(0).default(0),
  rewardDiamonds: z.number().int().min(0).default(0),
  endAt: z.string().datetime().optional(),
});

export type CreateAgencyTaskInput = z.infer<typeof createAgencyTaskSchema>;

export const requestPayoutSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const payoutIdParamsSchema = z.object({
  payoutId: z.string().uuid("Invalid payout ID"),
});

export const updatePayoutStatusSchema = z.object({
  status: z.enum([
    "requested",
    "under_review",
    "approved",
    "processing",
    "paid",
    "rejected",
    "failed",
    "cancelled",
  ]),
});

export type UpdatePayoutStatusInput = z.infer<typeof updatePayoutStatusSchema>;