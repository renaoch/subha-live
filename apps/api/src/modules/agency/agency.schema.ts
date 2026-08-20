import { z } from "zod";

export const agencyIdSchema = z.object({
  id: z.string().uuid("Invalid agency ID"),
});

export type AgencyIdInput =
  z.infer<typeof agencyIdSchema>;