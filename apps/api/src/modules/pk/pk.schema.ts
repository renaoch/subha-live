import { z } from "zod";

export const pkInviteSchema = z.object({
  roomId: z.string().uuid(),
  opponentHostId: z.string().uuid(),
});

export type PkInviteInput = z.infer<typeof pkInviteSchema>;

export const pkBattleIdSchema = z.object({
  battleId: z.string().min(1).max(120),
});

export type PkBattleIdParams = z.infer<typeof pkBattleIdSchema>;
