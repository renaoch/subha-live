import { z } from "zod";

const MIN_MS = 60_000; // a ban must last at least a minute
const MAX_MS = 10 * 365 * 24 * 60 * 60 * 1000; // ...and at most ~10 years (use permanent beyond that)

export const banUserSchema = z
  .object({
    type: z.enum(["temporary", "permanent"]),
    /** Required for temporary bans: when the ban lifts (any custom date/time). */
    until: z.coerce.date().optional(),
    /** Shown to the user on their ban screen. */
    reason: z.string().trim().min(3, "Give a reason (min 3 characters)").max(300),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "temporary") return;
    if (!v.until || Number.isNaN(v.until.getTime())) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "Pick when the ban ends" });
      return;
    }
    const ms = v.until.getTime() - Date.now();
    if (ms < MIN_MS) ctx.addIssue({ code: "custom", path: ["until"], message: "The end date must be in the future" });
    if (ms > MAX_MS) ctx.addIssue({ code: "custom", path: ["until"], message: "Max 10 years — use a permanent ban instead" });
  });

export const unbanUserSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

export type BanUserInput = z.infer<typeof banUserSchema>;
